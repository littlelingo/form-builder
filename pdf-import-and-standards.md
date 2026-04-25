# PDF Import + VA.gov Standards Conformance — Execution Plan

## Context

The VA Form Builder today only ingests authoring JSON. Goal: accept any government AcroForm PDF, produce a self-contained authoring JSON that loads identically to `examples/*.json`, score every component with a confidence value, surface accept/reject UX, capture corrections that improve future imports, and audit every form against a VA.gov standards registry.

This plan supersedes the prior draft. Differences from the prior version:

- Browser/Node boundary made explicit. LLM enricher made fully optional.
- Standards multi-source plumbing kept; V1 ships only `builtIn.json` (scrape + USWDS-docs sources deferred to V1.5).
- Standards rule DSL specified concretely (was previously hand-wavy).
- Confidence scoring formula specified concretely.
- bbox coord system normalized (page index + [0,1] relative coords).
- `formId` derivation order specified.
- LLM caching + determinism strategy specified.
- Sequencing reorganized as 8 vertical milestones, each independently shippable + testable.
- Test fixtures generated synthetically via pdf-lib instead of shipping real PDFs.

## Locked Decisions (recap)

- AcroForm PDFs only for V1.
- Hybrid engine: deterministic first, LLM enricher fills semantic gaps. LLM optional, gated by `ANTHROPIC_API_KEY`.
- Coverage: any government PDF form.
- Review UX: onboarding wizard at import open + inline confidence badge with accept/reject thereafter.
- Learning loop: local corrections corpus (JSONL), nearest-neighbor exemplars, manual export/share.
- Self-contained output: authoring JSON + source hash + sidecar PDF.
- Standards: multi-source plumbing, configurable priority order. V1 ships only `builtIn.json`. Refresh scripts deferred to V1.5.
- Non-VA export: warnings only, no hard block.
- Provenance: form-level `source`, form-level `lineage`, per-component `provenance`.

## Architecture Clarifications

### Browser/Node boundary

| Concern | Where it runs | Notes |
|---|---|---|
| AcroForm extraction (`pdf-lib`) | Both | `pdf-lib` is isomorphic ESM, no worker. Same code path for CLI + browser. |
| PDF page text + bbox (`pdfjs-dist`) | Both | Pin `pdfjs-dist@^4` legacy build for Node. Browser uses worker; Node skips worker via `disableWorker: true`. |
| Confidence scoring, classify, corpus lookup | Both | Pure JS, isomorphic. |
| LLM enricher (Claude API) | Node only (CLI) + dev proxy (browser) | Anthropic SDK requires API key. Browser path goes through a tiny local Express proxy at `apps/proxy/` started by `npm run builder:dev:proxy`. Without proxy or env var, importer still works with deterministic-only path. |
| Sidecar PDF write | Node only | Browser exports zip via `JSZip` (already proposed in `form-route-to-va-gov.md`); CLI writes files. |

### LLM optionality

Importer succeeds with or without LLM. Without it: every component lands at `confidence ≤ 0.5` with `origin: pdf-field`, no semantic enrichment. With it: enrichment lifts confidence and adds hint/classification. Tests run in deterministic-only mode by default; LLM-mode tests gated on `ANTHROPIC_API_KEY` env var presence.

### PDF library roles

- `pdf-lib`: AcroForm widget enumeration (field name, type, options, default value, required flag, max length, page index, raw PDF rect).
- `pdfjs-dist`: page text extraction with positions, bbox geometry conversion, browser-side rendering for `PdfSourcePreview.tsx`.
- Coords: PDF user space (bottom-left origin) converted at extraction time to normalized `{ page, x, y, w, h }` in [0,1] relative to page width/height. Stored that way in provenance. Renderer multiplies back up.

## Schema Additions (non-breaking, bump 1.0.0 → 1.1.0)

All new fields are optional. Existing `examples/*.json` remain valid.

Form-level:

```json
"source": {
  "kind": "pdf|normalizedForm|manual|scraped",
  "uri": "examples/21-526EZ/source.pdf",
  "hash": "sha256:...",
  "importedAt": "2026-04-25T...",
  "importedBy": "user-id"
},
"lineage": {
  "previousVersion": null,
  "createdFromVersion": null,
  "schemaHash": "sha256:..."
}
```

Per-component:

```json
"provenance": {
  "origin": "pdf-field|template|hand-authored",
  "pdfFieldName": "VeteranLastName",
  "pdfPage": 3,
  "bbox": { "page": 3, "x": 0.12, "y": 0.34, "w": 0.21, "h": 0.04 },
  "confidence": 0.84,
  "reviewed": false,
  "lastCorrectedBy": null,
  "exemplarId": null
}
```

## Standards Rule DSL

Two rule kinds. Both pure data so external governance sources can ship them.

### Structural rules (against form tree)

```json
{
  "id": "va.standards.intro-page-required",
  "kind": "structural",
  "scope": "form",
  "severity": "warning",
  "predicate": {
    "op": "anyChapterHas",
    "path": "pages",
    "where": { "op": "fieldEquals", "field": "id", "value": "introduction" }
  },
  "message": "VA forms should include an introduction page.",
  "fixHint": "Add a chapter with an 'introduction' page or load the Introduction template.",
  "source": "builtIn",
  "version": "2026.04"
}
```

Structural predicate ops (V1 set):

- `pathExists` — boolean check that a path resolves to a non-null value
- `pathEquals` — `{ path, value }`
- `pathIn` — `{ path, values: [...] }`
- `count` — `{ path, op: ">=" | "<=" | "==", value: n }`
- `anyChapterHas`, `everyChapterHas` — chapter-level traversal with nested `where` predicate
- `anyComponentHas`, `everyComponentHas` — component-level traversal with nested `where`
- `componentTypeIn` — `{ types: [...] }` against a single component scope
- `and`, `or`, `not` — boolean composition of nested predicates

### Content rules (against component fields)

```json
{
  "id": "va.standards.label-min-length",
  "kind": "content",
  "scope": "component",
  "severity": "warning",
  "predicate": {
    "op": "stringLength",
    "field": "label",
    "min": 2,
    "max": 120
  },
  "message": "Component labels should be 2-120 characters."
}
```

Content predicate ops (V1 set): `stringLength`, `stringMatches`, `stringNonEmpty`, `numberInRange`, `enumIn`.

### Audit output

```json
{
  "pass": false,
  "warnings": [
    { "ruleId": "va.standards.intro-page-required", "scope": "form", "componentId": null, "message": "...", "source": "builtIn" }
  ],
  "blockers": []
}
```

## Confidence Scoring Formula

Per-component confidence is a weighted sum, clamped to [0,1]:

```
confidence =
    0.30 * acroformSignal
  + 0.20 * labelDistance
  + 0.20 * classificationCertainty
  + 0.20 * corpusSimilarity
  + 0.10 * validationMatch
```

Signals:

- `acroformSignal` — 1.0 if field has explicit type + name + position; 0.5 if name only; 0.2 if widget without name.
- `labelDistance` — inverse of distance between AcroForm bbox center and nearest extracted text label, normalized; 1.0 if `pdfjs-dist` text is within 1× field height.
- `classificationCertainty` — LLM enricher returns `{ type, score }`; 0.5 in deterministic-only mode if heuristic guessed type; 0 if unknown type.
- `corpusSimilarity` — nearest-neighbor cosine over token-set of `pdfFieldName` + `neighborText`; 1.0 if identical exemplar found.
- `validationMatch` — 1.0 if AcroForm constraint matches a known authoring validation pattern (max length, required, regex on field name like `*Date* → date`).

Bands: `high ≥ 0.85`, `medium ≥ 0.6`, `low < 0.6`. Wizard auto-walks `low`; badge color cues all three.

## Importer Pipeline

```
PDF buffer
   │
   ▼
[1] hashAndExtractMeta            → { hash, formId, ombNumber, title, pageCount }
   │
   ▼
[2] extractAcroForm (pdf-lib)     → fields[]: { name, type, options, page, rectPdf, required, maxLength, default }
   │
   ▼
[3] extractTextLabels (pdfjs-dist) → labels[]: { text, page, bbox }
   │
   ▼
[4] pairLabelsToFields            → fields[] enriched with neighborText
   │
   ▼
[5] heuristicClassify             → fields[] enriched with guessedType + heuristicConfidence
   │
   ▼
[6] corpusLookup                  → fields[] enriched with exemplar match + similarity
   │
   ▼
[7] llmEnrich  (optional)         → fields[] enriched with cleanedLabel, hint, classification, grouping
   │
   ▼
[8] segmentIntoChaptersAndPages   → AuthoringChapter[]
   │
   ▼
[9] buildAuthoringForm            → AuthoringForm with source + lineage stamped
   │
   ▼
[10] stampProvenance              → every component has provenance + confidence
   │
   ▼
[11] runMigrations                → up-to-current schema version
   │
   ▼
[12] validateAuthoringForm        → throws on hard schema violations; returns warnings
   │
   ▼
{ form, importReport }
```

`importReport` contains: token usage (if LLM used), per-step durations, fields that fell back to deterministic, exemplar hits, suggested wizard steps.

## LLM Enricher: Caching + Determinism

- Model: `claude-sonnet-4-6` (default; override via env). Temperature 0.
- Prompt cache: cache the long instructional prefix + standards-rule reference; per-form variable suffix. Per Anthropic SDK 4.x prompt caching pattern.
- Per-import deterministic cache: SHA-256 of `{ pdfHash, prompt template version, model, temperature }` keys a file in `.cache/import/<key>.json`. Cache hit short-circuits LLM call. Cache committed only for fixtures, gitignored otherwise.
- Token budget: hard cap at 30k input + 8k output per import. Refuse + fallback to deterministic if exceeded.
- Mock mode: when `ANTHROPIC_API_KEY` unset OR `IMPORT_LLM_MOCK=1`, enricher returns deterministic stub output keyed on input hash. Lets tests run in CI without secrets.

## Review UX

- **Wizard at import open** (`ImportWizard.tsx`) — modal overlay. Walks (a) form-level decisions (formId, title, OMB block, chapter grouping), then (b) every `low`-band component. Each step: PDF region preview (`PdfSourcePreview.tsx`) + importer guess + accept / reject / edit-then-accept. Skip wizard if zero low-band items + form-level metadata high-confidence.
- **Inline badge** (`ConfidenceBadge.tsx`) — small chip in component header on canvas. Color band (green ≥0.85 / amber ≥0.6 / red <0.6). Click reveals provenance + accept/reject. Accept clears chip; reject opens inspector with suggested alternatives.
- **Review panel** (`ImportReviewPanel.tsx`) — tab in inspector area listing every unreviewed component, ascending by confidence, with jump-to + bulk-accept. Counter on tab badge.
- Every accept/reject/edit appends to `corrections.jsonl`.

## Corrections Corpus

Row shape (one per JSONL line):

```json
{
  "exemplarId": "uuid",
  "pdfFieldName": "VeteranLastName",
  "pdfFieldType": "Tx",
  "neighborText": ["Last name of Veteran"],
  "componentTypeBefore": "textInput",
  "componentTypeAfter": "textInput",
  "labelBefore": "Veterans Last Name",
  "labelAfter": "Veteran's last name",
  "validationsAfter": [],
  "formFingerprint": "21-526EZ",
  "createdAt": "2026-04-25T...",
  "createdBy": "user-id"
}
```

- Lookup: token-set Jaccard over `pdfFieldName` + `neighborText` joined. Threshold ≥0.7 = exemplar match.
- Storage: `src/import/corpus/corrections.jsonl` for committed seed; per-author additions in browser `localStorage` until exported via UI; CLI mode appends to a configurable path (`--corpus ./my-corpus.jsonl`).
- Embedding upgrade path noted as V1.5 (token-set is fine for hundreds of exemplars).

## Standards Audit

- V1 ships only `src/standards/sources/builtIn.json` — hand-curated rule list seeded from research plan + manual review of `vets-website-main` simple-forms patterns.
- `priority.mjs` exists from day one with default `external > USWDS > scrape > builtIn`, but only `builtIn` is loaded. Adding new sources later = drop a JSON file in `sources/` and register in priority order.
- `audit.mjs` evaluates rules against `AuthoringForm`, returns `{ pass, warnings, blockers }`.
- `StandardsAuditPanel.tsx` groups by source + severity; shows rule id, message, fix hint, jump-to component for `scope: component` rules.
- VA.gov export gate (in `form-route-to-va-gov.md`) consumes audit result and surfaces in export dialog as warnings (no hard block per locked decision).

## Risks + Mitigations

| Risk | Mitigation |
|---|---|
| `pdfjs-dist` Node integration brittleness | Pin to known-working version; use legacy build; integration test in CI. |
| LLM cost runaway on large forms | Token budget cap + cache + mock mode. Hard refuse + fallback to deterministic on overrun. |
| Browser API key exposure | LLM enricher only runs through local proxy in dev; never inline in browser bundle. |
| Non-deterministic LLM output breaking tests | Temperature 0 + prompt cache + per-import file cache + fixture-locked golden snapshots. |
| Standards rules too rigid, blocks valid forms | All rules `severity: warning` for V1; `error` requires explicit author flag. |
| PDF binaries bloat repo | Test fixtures generated synthetically with `pdf-lib` at test setup; one real fixture only for manual verification (kept under `fixtures-real/` and gitignored). |
| Schema migration framework over-engineered for non-breaking add | v1.0.0 → v1.1.0 migrator is no-op; framework exists but does nothing. Real value when v1.1.0 → v2.0.0 lands later. |

## Sequencing — 8 Milestones

Each milestone independently shippable + green-tested. Sequence chosen so each lands a usable slice; later milestones build on earlier without rework.

### Milestone 1 — Schema + Migration Skeleton

Deliverables:

- Bump `schemaVersion` to `1.1.0` in `src/schema/authoring-schema.json`. Add optional `source`, `lineage`, `provenance` per component.
- Update `apps/builder/src/types.ts` with optional `AuthoringSource`, `AuthoringLineage`, `AuthoringProvenance` types; add to `AuthoringForm` and `AuthoringComponent`.
- New: `src/schema/migrations/registry.mjs`, `src/schema/migrations/v1_0_0-to-v1_1_0.mjs` (no-op + version bump).
- New: `tests/migrations.test.mjs` — load v1.0.0 fixture, run, assert v1.1.0 + still validates.
- Existing examples re-saved through migrator to seed `lineage.schemaHash` (no behavior change).

Verification: `npm test` green. `npm run builder:build` green. `npm run compile:example` + `compile:example:27-8832` unchanged output.

### Milestone 2 — Standards Rule DSL + Audit (single source)

Deliverables:

- New: `src/standards/predicate.mjs` — pure evaluator for the structural + content predicate ops listed above.
- New: `src/standards/audit.mjs` — `auditForm(form, rules) → { pass, warnings, blockers }`.
- New: `src/standards/priority.mjs` — `mergeRules(sources, priorityOrder)` returns deduped rule list with `winningSource` per id.
- New: `src/standards/sources/builtIn.json` — hand-curated seed (intro-page, label length, OMB info presence, prefill mappings for veteran identity, label/hint required for input components, accessibility minimums).
- New: `src/standards/index.mjs` — public API: `loadStandards()`, `auditForm()`.
- Re-export from `src/index.mjs` and `apps/builder/src/lib/core.ts`.
- New: `tests/standards.test.mjs` — predicate ops, priority resolution with dummy second source, audit on both example forms.

Verification: `npm test` green; both `examples/21-4140` and `examples/27-8832` audit results stable + snapshot-tested.

### Milestone 3 — Deterministic AcroForm Importer + CLI

Deliverables:

- Add deps: `pdf-lib`, `pdfjs-dist`. Lock versions.
- New: `src/import/extract/acroform.mjs` — pdf-lib-based field extractor.
- New: `src/import/extract/text.mjs` — pdfjs-dist-based label extractor with bbox normalization.
- New: `src/import/extract/pair.mjs` — pair labels to fields by spatial proximity.
- New: `src/import/heuristic/classify.mjs` — heuristic component-type guess (regex on field name + AcroForm widget type).
- New: `src/import/heuristic/segment.mjs` — group fields into pages by spatial gaps + page breaks; group pages into chapters by section headings.
- New: `src/import/build.mjs` — assemble `AuthoringForm` from extraction output, stamp provenance.
- New: `src/import/pipeline.mjs` — orchestrator. Calls extract → pair → classify → segment → build → stamp → migrate → validate.
- New: `src/import/confidence.mjs` — score per formula above.
- New: `src/cli/import.mjs` — `node src/cli/import.mjs <pdf> --out examples/<form-id>` writes JSON + sidecar.
- New: `tests/import.test.mjs` — generates synthetic AcroForm PDF with `pdf-lib` in test setup, runs importer, asserts schema validates, asserts deterministic output across two runs.
- Add `npm run import` script to `package.json`.

Verification: importer produces a valid authoring JSON for the synthetic fixture. Deterministic across runs. Loads in builder via existing import-JSON path.

### Milestone 4 — Builder UI: Confidence Badge + Import Action + PDF Preview

Deliverables:

- New: `apps/builder/src/components/ConfidenceBadge.tsx` — chip in component header with provenance reveal + accept/reject buttons.
- Update: `apps/builder/src/components/StructurePanel.tsx` and `InspectorPanel.tsx` to render badge when `provenance` present.
- New: `apps/builder/src/lib/reviewState.ts` — `acceptComponent(id)`, `rejectComponent(id)` mutators that update `provenance.reviewed` + append corpus row.
- New: `apps/builder/src/lib/importClient.ts` — wraps `src/import/pipeline.mjs` for browser + handles file upload.
- New: `apps/builder/src/components/PdfSourcePreview.tsx` — pdfjs-dist canvas with bbox highlight overlay for selected component.
- Update: `apps/builder/src/components/FormActions.tsx` — add **Import PDF** action (file picker → `importClient` → loads result into form model).
- Update: `tests/builder-smoke.mjs` — import a synthetic PDF, accept a component, assert badge clears.

Verification: in builder, choose Import PDF, pick fixture, see imported form with badges. Click badge → see provenance + PDF preview. Accept clears badge.

### Milestone 5 — LLM Enricher with Cache + Mock

Deliverables:

- Add dep: `@anthropic-ai/sdk`.
- New: `src/import/llm/enricher.mjs` — Anthropic call with prompt caching. Reads `ANTHROPIC_API_KEY`, `IMPORT_LLM_MOCK`. Falls back to deterministic + warns if unavailable.
- New: `src/import/llm/cache.mjs` — file-based cache keyed on `{pdfHash, promptVersion, model}` under `.cache/import/`.
- New: `src/import/llm/mock.mjs` — deterministic stub for tests.
- New: `apps/proxy/` — minimal Express/Fastify proxy: single `POST /api/enrich` route forwarding to Anthropic SDK. Started by `npm run builder:dev:proxy`. Requires `ANTHROPIC_API_KEY`.
- Update: `src/import/pipeline.mjs` — wire enricher into step 7.
- Update: `tests/import.test.mjs` — add LLM-mocked test asserting enriched output structure.
- Add `npm run builder:dev:proxy` script.

Verification: with `IMPORT_LLM_MOCK=1`, importer test produces stable enriched output. With real `ANTHROPIC_API_KEY` (manual), proxy + browser import produce enriched form. Token budget cap respected.

### Milestone 6 — Corrections Corpus + Nearest-Neighbor

Deliverables:

- New: `src/import/corpus/corrections.jsonl` — empty seed file checked in.
- New: `src/import/corpus/store.mjs` — read/append JSONL helpers (Node fs + browser localStorage).
- New: `src/import/corpus/lookup.mjs` — token-set Jaccard nearest-neighbor.
- Update: `src/import/pipeline.mjs` — step 6 (corpusLookup) consults corpus, lifts confidence on hit.
- Update: `apps/builder/src/lib/reviewState.ts` — accept/reject/edit appends row.
- Update: `apps/builder/src/components/FormActions.tsx` — Export corrections / Import corrections buttons (mirror saved-template pattern).
- New: `tests/corpus.test.mjs` — append, lookup, similarity, lift-confidence behavior.

Verification: import same PDF twice, edit a label on first run, re-import → second run lifts confidence on that field via corpus hit.

### Milestone 7 — Import Wizard + Review Panel

Deliverables:

- New: `apps/builder/src/components/ImportWizard.tsx` — modal walking form-level decisions then low-band components. Jumps PDF preview + inspector. Records accept/reject.
- New: `apps/builder/src/components/ImportReviewPanel.tsx` — inspector tab listing unreviewed components ascending by confidence.
- Update: `apps/builder/src/App.tsx` — open wizard automatically on successful import if any low-band items.
- Update: `tests/builder-smoke.mjs` — wizard click-through.

Verification: import synthetic PDF with at least one low-band field; wizard opens; walking through to completion clears all low-band components.

### Milestone 8 — Standards Audit Panel + Export Gate Wiring

Deliverables:

- New: `apps/builder/src/components/StandardsAuditPanel.tsx` — grouped warnings/blockers, fix hints, jump-to-component.
- Update: `apps/builder/src/components/InspectorPanel.tsx` (or replace existing AuditPanel) — adds Standards tab alongside existing schema-diff Audit.
- Update: VA.gov export dialog (from `form-route-to-va-gov.md`) — surfaces standards warnings inline with export readiness; export still allowed (warnings only per locked decision).
- Update: `tests/builder-smoke.mjs` — open standards panel, see warnings, open export dialog and confirm warnings shown.

Verification: load `examples/21-4140-authoring.json` → standards panel shows seeded warnings. Open export dialog → same warnings present, export still allowed.

## Critical Files to Modify or Create

Schema + types:

- `src/schema/authoring-schema.json` — extend
- `src/schema/migrations/registry.mjs` — NEW
- `src/schema/migrations/v1_0_0-to-v1_1_0.mjs` — NEW
- `apps/builder/src/types.ts` — extend

Standards:

- `src/standards/predicate.mjs` — NEW
- `src/standards/audit.mjs` — NEW
- `src/standards/priority.mjs` — NEW
- `src/standards/sources/builtIn.json` — NEW
- `src/standards/index.mjs` — NEW

Import core:

- `src/import/pipeline.mjs` — NEW
- `src/import/extract/acroform.mjs` — NEW
- `src/import/extract/text.mjs` — NEW
- `src/import/extract/pair.mjs` — NEW
- `src/import/heuristic/classify.mjs` — NEW
- `src/import/heuristic/segment.mjs` — NEW
- `src/import/build.mjs` — NEW
- `src/import/confidence.mjs` — NEW
- `src/import/llm/enricher.mjs` — NEW
- `src/import/llm/cache.mjs` — NEW
- `src/import/llm/mock.mjs` — NEW
- `src/import/corpus/store.mjs` — NEW
- `src/import/corpus/lookup.mjs` — NEW
- `src/import/corpus/corrections.jsonl` — NEW (empty seed)

CLI + dev proxy:

- `src/cli/import.mjs` — NEW
- `apps/proxy/` — NEW (minimal Express)

Builder UI:

- `apps/builder/src/components/ConfidenceBadge.tsx` — NEW
- `apps/builder/src/components/PdfSourcePreview.tsx` — NEW
- `apps/builder/src/components/ImportWizard.tsx` — NEW
- `apps/builder/src/components/ImportReviewPanel.tsx` — NEW
- `apps/builder/src/components/StandardsAuditPanel.tsx` — NEW
- `apps/builder/src/components/FormActions.tsx` — extend
- `apps/builder/src/components/StructurePanel.tsx` — extend (badge render)
- `apps/builder/src/components/InspectorPanel.tsx` — extend (badge + standards tab)
- `apps/builder/src/lib/importClient.ts` — NEW
- `apps/builder/src/lib/reviewState.ts` — NEW
- `apps/builder/src/lib/formModel.ts` — extend (provenance helpers)
- `apps/builder/src/App.tsx` — wizard auto-open

Tests:

- `tests/migrations.test.mjs` — NEW
- `tests/standards.test.mjs` — NEW
- `tests/import.test.mjs` — NEW
- `tests/corpus.test.mjs` — NEW
- `tests/builder-smoke.mjs` — extend

Package metadata:

- `package.json` — add `pdf-lib`, `pdfjs-dist`, `@anthropic-ai/sdk`, `express` (proxy); add `import`, `builder:dev:proxy` scripts

## Reused Existing Pieces

- `compileAuthoringForm`, `validateAuthoringForm` (`src/compiler/authoringCompiler.mjs`) — round-trip verification after import.
- `componentRegistry.mjs` — target component types for classification output.
- `componentSystems.mjs` — pre-import validation that classified types are supported.
- `diffAuthoringForms` (`src/audit/diff.mjs`) — version-vs-version diff alongside standards audit in inspector.
- `runnerFlow.js`, `runnerValidation.js` — imported form runs in builder runner immediately.
- `FormActions.tsx` saved-template export/import pattern — same UX for corrections corpus share.
- `OutputPanel.tsx` per-file preview pattern (from export plan) — re-used for imported authoring JSON + sidecar PDF preview.

## End-to-End Verification

- `npm test` — every test file passes including new ones. CI runs in deterministic-only mode (no API key).
- `npm run builder:build` — type-check + Vite build pass.
- `npm run builder:smoke` — Playwright covers: import synthetic PDF, walk wizard, accept low-band, run runner, edit a label, re-import, see corpus-lifted confidence, open standards panel, open export dialog with warnings.
- `npm run compile:example` + `compile:example:27-8832` — unchanged output (golden-snapshotted).
- Manual with real PDF + real API key: drop a real VA AcroForm PDF (e.g., 21-526EZ) into `fixtures-real/`, run `node src/cli/import.mjs ./fixtures-real/21-526EZ.pdf --out examples/21-526EZ`, open builder, walk review wizard, run form, export through `form-route-to-va-gov.md` pipeline, confirm generated VA app folder builds + form renders.

## Out of Scope for This Plan

- Flat/scanned PDF + OCR — V2.
- Backend learning service or shared corpus sync — V2.
- Embedding-based exemplar similarity — V1.5.
- `vetsWebsiteScrape.json` + `uswdsDocs.json` refresh scripts — V1.5 (multi-source plumbing in place; just no second source loaded yet).
- External governance source loader — V1.5.
- Scheduled background refresh of standards sources — V2.
- Hard export blocks for non-VA forms — explicit decision: warn only.
- Pluggable export targets beyond VA.gov + generic — see `form-route-to-va-gov.md`.
- Backend draft/version storage (research plan Artifact 4) — separate plan.
- Submitted/PDF display template generation — out of MVP.

## V1.5 / V2 Backlog (deferred)

- Standards source: `vetsWebsiteScrape.mjs` script that walks `vets-website-main/src/applications/simple-forms/*/config/form.js`, derives frequency-based rules.
- Standards source: `uswdsDocsScrape.mjs` reading from local `package/` USWDS source for accessibility + content rules.
- External governance loader: HTTP fetch + cache + signature verification.
- Embedding-based corpus lookup (replace token-set Jaccard).
- OCR fallback for scanned PDFs (Tesseract or paid OCR API).
- Shared corpus sync (backend service).
- Per-source rule autofix actions (`fixHint` becomes executable transform).
- Rule severity escalation policy (some rules promoted from warning to error after grace period).
