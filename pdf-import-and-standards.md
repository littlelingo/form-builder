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

## Pilot Form + Minimum Quality Bar

The two existing `examples/*.json` forms are the **floor**, not the ceiling. Importer output must match or exceed their quality on every form processed. Standards layer + LLM enricher + corpus exist to push beyond this baseline, not just match it.

- `examples/27-8832-authoring.json` was previously produced by an LLM (Codex) converting `~/Downloads/VBA-27-8832-ARE.pdf` (a real VA AcroForm PDF). Floor for: chapter grouping, applicant-type conditional branching across chapters, multi-select checkbox groups, address blocks, no-prefill flow.
- `examples/21-4140-authoring.json` floor for: list-loop chapters (employment), file upload with showIf gating, prefill mappings, computed values, contact summary.

The importer's job is to reproduce these (or better) **from the source PDF alone**, inside the builder, without a human driving an external LLM session. The pilot bootstrap PDF is `VBA-27-8832-ARE.pdf` because we already have the floor-quality JSON to regression-test against.

What "exceed the floor" means in practice:

- Catch field types the original conversion missed or genericized (e.g., specific masked patterns, date subtypes).
- Add hint text where original is bare (importer enricher should always attempt a hint).
- Detect listLoop / repeated patterns the original may have flattened.
- Apply standards-layer fixes the original predates (label length, required hint coverage, accessibility minimums).
- Stamp provenance + confidence the original lacks entirely.

Implications:

- Both example JSONs are seeded into the corrections corpus as exemplars for structural patterns (chapter grouping, conditional rules, list-loop detection, prefill defaults) — not just for individual field labels.
- LLM enricher prompt includes both example JSONs as few-shot exemplars so classification + grouping + conditional-logic output approximates the same shape.
- Both example forms retro-stamped with `source` + `provenance` blocks during M1 migration so they look schema-identical to importer output.
- Gold-standard regression test asserts importer output is **equal-or-better** than the seeded example: structural equivalence (chapter count, page count, conditional rules present, key field IDs present, listLoop chapters detected) is the floor; standards-audit warning count must be **≤** the seeded form's warning count; per-field hint coverage must be **≥**. Importer regressions fail the test; importer improvements pass and update the snapshot under explicit author confirmation.

PDF storage convention:

- Real source PDFs live under `fixtures-real/` (gitignored by default; opt-in commit if license + size permit).
- `examples/<form-id>/source.pdf` is the canonical sidecar location once an example is regenerated through the importer.
- Pilot PDF copy committed at `tests/fixtures/pilot/VBA-27-8832-ARE.pdf` only if redistribution is permitted; otherwise referenced by hash with `tests/fixtures/pilot/README.md` pointing to the public download URL.

## Locked Decisions (recap)

- AcroForm PDFs only for V1.
- Hybrid engine: deterministic first, LLM enricher fills semantic gaps. LLM optional. Provider-abstracted: local LLM (Ollama / OpenAI-compatible server) default, cloud LLM (Anthropic) opt-in. Government-data privacy posture favors local.
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
| LLM enricher (any provider) | Node only (CLI) + dev proxy (browser) | Provider-abstracted (local Ollama default, OpenAI-compatible alt, Anthropic Claude opt-in). Browser path goes through `apps/proxy/` started by `npm run builder:dev:proxy`. Proxy forwards to whichever provider is configured. Without proxy or provider, importer still works deterministic-only. |
| Sidecar PDF write | Node only | Browser exports zip via `JSZip` (already proposed in `form-route-to-va-gov.md`); CLI writes files. |

### LLM optionality + provider abstraction

Importer succeeds with or without LLM. Without it: every component lands at `confidence ≤ 0.5` with `origin: pdf-field`, no semantic enrichment. With it: enrichment lifts confidence and adds hint/classification.

Provider interface (`src/import/llm/provider.mjs`):

```
{
  name: string,
  isAvailable(): Promise<boolean>,
  enrich(payload, options): Promise<EnrichResult>
}
```

Adapters shipped V1:

- `ollama.mjs` — talks to local Ollama (`http://localhost:11434`). Default. Recommended model: `llama3.1:8b` or `qwen2.5:14b` (structured-output capable). Supports `format: 'json'` for JSON-mode output.
- `openaiCompatible.mjs` — generic OpenAI-compatible chat completions endpoint. Works with LM Studio, llama.cpp server, vLLM, LocalAI. Configurable `baseUrl`.
- `claude.mjs` — Anthropic SDK. Cloud opt-in. Requires `ANTHROPIC_API_KEY`. Best quality on edge cases.
- `mock.mjs` — deterministic stub keyed on input hash. Used by tests + CI.

Selection:

- `IMPORT_LLM_PROVIDER=ollama|openai-compatible|claude|mock` (default `ollama`).
- `IMPORT_LLM_MODEL=...` (per-provider default).
- `IMPORT_LLM_BASE_URL=...` (for ollama + openai-compatible).
- Fallback chain: configured provider → if `isAvailable()` false, log warning + drop to deterministic. No silent provider swap.

Privacy default: local. Document in README that switching to cloud Claude sends extracted PDF text + field labels to a third party; require explicit opt-in. Government / VA-internal authors should leave default.

Tests run in `mock` mode in CI. Local-LLM tests gated on `ollama` reachable. Cloud-LLM tests gated on `ANTHROPIC_API_KEY` env var presence.

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

- Default provider: Ollama with `llama3.1:8b` (override via `IMPORT_LLM_MODEL`). Cloud override: Anthropic `claude-sonnet-4-6`.
- Temperature 0 across providers.
- JSON-mode where supported (Ollama `format: 'json'`, Anthropic structured tool-use, OpenAI-compatible `response_format: { type: 'json_object' }`).
- Prompt structure: stable instructional prefix + few-shot exemplars from existing example forms + standards-rule reference + per-form variable suffix. Stable prefix benefits provider-side caches when available (Anthropic prompt caching; Ollama keep-alive).
- Per-import deterministic cache: SHA-256 of `{ pdfHash, promptVersion, providerName, modelId }` keys a file in `.cache/import/<key>.json`. Cache hit short-circuits LLM call. Cache committed only for fixtures, gitignored otherwise.
- Token budget: hard cap at 30k input + 8k output per import. Refuse + fallback to deterministic if exceeded.
- Mock mode: `IMPORT_LLM_PROVIDER=mock` (or auto when no provider available) returns deterministic stub output keyed on input hash. Lets tests run in CI without local models or secrets.

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
| LLM cost runaway on cloud provider | Token budget cap + cache + mock mode. Hard refuse + fallback to deterministic on overrun. Local provider default = $0. |
| Browser API key exposure | LLM enricher only runs through local proxy in dev; never inline in browser bundle. Local provider doesn't require a key. |
| Non-deterministic LLM output breaking tests | Temperature 0 + JSON-mode + per-import file cache + fixture-locked golden snapshots. CI uses `mock` provider. |
| Local model quality below floor on pilot | Document minimum model size (e.g., `qwen2.5:14b` over `llama3.1:8b` if floor fails). Pilot test failure on local prompts user to upgrade model or opt into cloud. |
| Government data leakage to third party | Default provider is local (no network egress). Cloud opt-in requires explicit env var + documented in README. |
| Standards rules too rigid, blocks valid forms | All rules `severity: warning` for V1; `error` requires explicit author flag. |
| PDF binaries bloat repo | Test fixtures generated synthetically with `pdf-lib` at test setup; one real fixture only for manual verification (kept under `fixtures-real/` and gitignored). |
| Schema migration framework over-engineered for non-breaking add | v1.0.0 → v1.1.0 migrator is no-op; framework exists but does nothing. Real value when v1.1.0 → v2.0.0 lands later. |

## Sequencing — 8 Milestones

Each milestone independently shippable + green-tested. Sequence chosen so each lands a usable slice; later milestones build on earlier without rework.

### Milestone 1 — Schema + Migration Skeleton + Retro-stamp

Deliverables:

- Bump `schemaVersion` to `1.1.0` in `src/schema/authoring-schema.json`. Add optional `source`, `lineage`, `provenance` per component.
- Update `apps/builder/src/types.ts` with optional `AuthoringSource`, `AuthoringLineage`, `AuthoringProvenance` types; add to `AuthoringForm` and `AuthoringComponent`.
- New: `src/schema/migrations/registry.mjs`, `src/schema/migrations/v1_0_0-to-v1_1_0.mjs` (no-op + version bump + back-fill `lineage.schemaHash`).
- New: `tests/migrations.test.mjs` — load v1.0.0 fixture, run, assert v1.1.0 + still validates.
- Retro-stamp `examples/27-8832-authoring.json` and `examples/21-4140-authoring.json`:
  - Form-level `source.kind: "pdf"`, `source.uri` pointing at the (gitignored or referenced) sidecar PDF, `source.hash` from the file when present.
  - Form-level `lineage.schemaHash` computed.
  - Per-component `provenance.origin: "hand-authored"`, `confidence: 1.0`, `reviewed: true` (these are the minimum-bar exemplars; treat as fully reviewed).
- Both retro-stamped examples remain compile-clean through `compile:example` and `compile:example:27-8832`.

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
- New: `tests/import-pilot.test.mjs` — gated on presence of `tests/fixtures/pilot/VBA-27-8832-ARE.pdf`. Runs importer in deterministic-only mode against the pilot PDF and asserts **structural floor**: chapter count ≥ seeded example, page count ≥ seeded example, all key field IDs from the seeded example present in importer output, conditional rules detected on `applicantType` chapters, no schema validation errors. Without LLM, this asserts the deterministic baseline; LLM-on run (M5+) asserts equal-or-better full match.
- Add `npm run import` script to `package.json`.

Verification: importer produces a valid authoring JSON for the synthetic fixture. Deterministic across runs. Loads in builder via existing import-JSON path. Pilot regression test passes at deterministic floor.

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

### Milestone 5 — LLM Enricher (Provider-Abstracted) + Cache + Mock + Few-Shot Floor

Deliverables:

- New: `src/import/llm/provider.mjs` — provider interface (`name`, `isAvailable`, `enrich`).
- New: `src/import/llm/providers/ollama.mjs` — local Ollama adapter (default). HTTP to `http://localhost:11434/api/chat` with `format: 'json'`.
- New: `src/import/llm/providers/openaiCompatible.mjs` — generic OpenAI-compatible chat completions. Configurable `baseUrl`. Works with LM Studio, llama.cpp, vLLM, LocalAI.
- New: `src/import/llm/providers/claude.mjs` — Anthropic SDK adapter with prompt caching. Opt-in.
- New: `src/import/llm/providers/mock.mjs` — deterministic stub keyed on input hash.
- New: `src/import/llm/registry.mjs` — provider lookup by name + env-driven selection + availability check + fallback.
- New: `src/import/llm/enricher.mjs` — provider-agnostic enrich orchestration. Reads provider via registry; respects `IMPORT_LLM_PROVIDER`, `IMPORT_LLM_MODEL`, `IMPORT_LLM_BASE_URL`.
- New: `src/import/llm/prompts/` — versioned prompt templates. `system.txt` (role + standards summary + minimum-bar criteria), `fewshot.json` (loads `examples/27-8832-authoring.json` and `examples/21-4140-authoring.json` as exemplar input/output pairs alongside their source PDFs' extracted field lists), `user.tmpl` (per-import variable suffix). Identical across providers; per-provider request shaping is the adapter's job.
- New: `src/import/llm/cache.mjs` — file-based cache keyed on `{pdfHash, promptVersion, providerName, modelId}` under `.cache/import/`. Prompt version bumps invalidate cache.
- Add deps: `@anthropic-ai/sdk` (claude adapter only). Ollama + OpenAI-compatible adapters use `fetch` only — no extra deps.
- New: `apps/proxy/` — minimal Express/Fastify proxy with single `POST /api/enrich` route. Reads provider config from env; forwards to whichever adapter is selected. Started by `npm run builder:dev:proxy`.
- Update: `src/import/pipeline.mjs` — wire enricher into step 7. Enricher receives extracted fields + heuristic + corpus exemplars; returns refined classification, grouping, conditional-logic suggestions, hint text, and listLoop detection.
- Update: `tests/import.test.mjs` — add LLM-mocked test asserting enriched output structure (provider = `mock`).
- Update: `tests/import-pilot.test.mjs` — three tiers:
  1. **mock provider** (CI default): assert structural floor + provenance shape.
  2. **ollama provider** (gated on `ollama` reachable): assert importer output matches `examples/27-8832-authoring.json` at full equal-or-better threshold. Documents minimum local model required.
  3. **claude provider** (gated on `ANTHROPIC_API_KEY` + explicit `IMPORT_RUN_CLOUD_TESTS=1`): same threshold; serves as ceiling reference.
- New: `docs/import-llm-providers.md` — setup notes for Ollama (recommended models, install instructions), LM Studio, vLLM, Anthropic. Document privacy posture (local default, cloud opt-in).
- Add `npm run builder:dev:proxy` script.

Verification: with `IMPORT_LLM_PROVIDER=mock`, importer test produces stable enriched output and meets pilot floor. With local Ollama + recommended model, pilot test meets equal-or-better threshold. With Claude key (manual), proxy + browser import produce enriched form. Token budget cap respected. No silent provider swap on adapter unavailability.

### Milestone 6 — Corrections Corpus + Nearest-Neighbor + Seed From Examples

Deliverables:

- New: `src/import/corpus/corrections.jsonl` — pre-seeded with rows derived from `examples/27-8832-authoring.json` + `examples/21-4140-authoring.json`. Each component in those examples becomes one exemplar row capturing its `pdfFieldName` (when known), `componentTypeAfter`, `labelAfter`, `validationsAfter`, `formFingerprint`. Generated by a one-shot script `src/import/corpus/seed.mjs` so re-runs are reproducible.
- New: `src/import/corpus/seed.mjs` — Node script that walks the example forms + (optionally) source PDFs, emits seed JSONL.
- New: `src/import/corpus/store.mjs` — read/append JSONL helpers (Node fs + browser localStorage).
- New: `src/import/corpus/lookup.mjs` — token-set Jaccard nearest-neighbor; also exposes structural exemplar lookup (chapter-pattern matching for listLoop detection, conditional-branching detection).
- Update: `src/import/pipeline.mjs` — step 6 (corpusLookup) consults corpus for both per-field and structural exemplars, lifts confidence on hit.
- Update: `apps/builder/src/lib/reviewState.ts` — accept/reject/edit appends row.
- Update: `apps/builder/src/components/FormActions.tsx` — Export corrections / Import corrections buttons (mirror saved-template pattern).
- New: `tests/corpus.test.mjs` — append, lookup, similarity, lift-confidence behavior, seed-script reproducibility.

Verification: import same PDF twice, edit a label on first run, re-import → second run lifts confidence on that field via corpus hit. Pilot test confirms structural exemplars from examples lift listLoop + conditional-branching detection on the pilot PDF.

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

- `package.json` — add `pdf-lib`, `pdfjs-dist`, `@anthropic-ai/sdk` (cloud opt-in), `express` (proxy); add `import`, `builder:dev:proxy` scripts. Ollama + OpenAI-compatible adapters use `fetch` only.

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
