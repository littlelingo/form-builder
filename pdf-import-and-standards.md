# PDF Import + VA.gov Standards Conformance

## Context

The VA Form Builder today only ingests authoring JSON (manual creation or `examples/*.json` import). The next-step capability is to accept a PDF form, convert it to accessible, editable, runnable authoring JSON inside the builder, and route the result to VA.gov through the existing compiler/export pipeline (see `form-route-to-va-gov.md`).

The builder also lacks a VA.gov standards layer. Without one, imported forms cannot be assessed for conformance (OMB metadata, accessibility, allowed component patterns, required pages, content style), and the audit panel can only diff one schema version against another rather than against the VA.gov baseline rules a form must satisfy.

This plan covers both: a PDF import subsystem and a multi-source standards/conformance subsystem, with locked decisions captured from interview.

## Goal

- Accept any government AcroForm PDF as input.
- Produce a self-contained authoring JSON that loads identically to the existing `examples/*.json` files.
- Score every imported component with a confidence value; surface accept/reject affordance in the builder.
- Capture corrections in a local corpus that improves future imports.
- Audit every form (imported or hand-built) against a multi-source VA.gov standards registry.
- Allow VA.gov export with conformance warnings; do not hard-block non-VA forms.

## Locked Decisions (from interview)

- **Input format**: AcroForm PDFs only for V1.
- **Engine**: Hybrid — deterministic parser first (`pdfjs-dist` + `pdf-lib`), LLM enricher fills semantic gaps (label cleanup, hint extraction, question grouping, classification).
- **Coverage**: Any government PDF form (importer is domain-agnostic; standards layer is VA-specific).
- **Review UX**: Hybrid — onboarding wizard at import open + inline per-component confidence badge with accept/reject for the rest of the session.
- **Learning loop**: Local corrections corpus (JSONL in repo or `localStorage`); manual export/share. Nearest-neighbor exemplars on next import.
- **Self-contained output**: Authoring JSON + source hash + sidecar PDF (e.g., `examples/<form-id>/source.pdf`). JSON loads without the PDF; PDF preserved for re-import + provenance.
- **Standards source**: Multi-source — scraped from `vets-website-main`, USWDS docs, and external governance (URL configurable per project). Configurable priority order; default external > USWDS > scrape > built-in.
- **Standards refresh**: Manual now, schedule-aware later.
- **Standards storage**: In-repo files (`src/standards/*.json`, `src/import/corpus/*.jsonl`).
- **Non-VA export**: Allow VA export with warnings only; surface conformance gaps but do not block.
- **Provenance**: Form-level `source` block + per-component `provenance` block + form-level `lineage` block. Add to authoring schema now.

## Recommended Architecture

### Subsystem layout

```
src/
  import/
    adapters/
      acroformPdf.mjs        # deterministic AcroForm extractor (pdfjs-dist + pdf-lib)
      llmEnricher.mjs        # Claude API semantic enrichment pass
    pipeline.mjs             # adapter orchestration + confidence scoring + provenance stamping
    classify.mjs             # form fingerprint + standard-pattern matching (claimant identity, contact, etc.)
    confidence.mjs           # confidence scoring helpers (rule + corpus + LLM signals)
    corpus/
      corrections.jsonl      # learning corpus (committed seed + author additions)
      exemplars.mjs          # nearest-neighbor lookup over corrections
    review.mjs               # builds the import review queue + wizard payload
  standards/
    sources/
      builtIn.json           # hand-curated baseline rules
      vetsWebsiteScrape.json # output of refresh script
      uswdsDocs.json         # output of refresh script
      external.config.mjs    # configurable governance source (file path or URL)
    priority.mjs             # configurable resolver (default external > USWDS > scrape > builtIn)
    refresh.mjs              # manual sync entrypoints (CLI now, scheduled later)
    audit.mjs                # standards conformance check returning {pass, warnings, blockers}
  schema/
    authoring-schema.json    # add source, provenance, lineage blocks
    migrations/
      registry.mjs           # version → migrator map, runMigrations(form)
      v1-to-v2.mjs           # initial no-op migrator (anchors the framework)
apps/builder/src/components/
  ImportWizard.tsx           # onboarding review wizard at import time
  ConfidenceBadge.tsx        # inline per-component badge (accept/reject)
  ImportReviewPanel.tsx      # batch review tab listing unreviewed components
  StandardsAuditPanel.tsx    # multi-source standards audit with priority indicators
  PdfSourcePreview.tsx       # side-by-side PDF preview for review context
apps/builder/src/lib/
  importClient.ts            # browser-side wrapper around src/import/pipeline.mjs
  reviewState.ts             # per-component reviewed/accepted state in builder model
src/cli/
  import.mjs                 # CLI: PDF in, authoring JSON + sidecar out
  refreshStandards.mjs       # CLI: pull/refresh standards sources
```

### Import pipeline flow

1. **Ingest** (`pipeline.mjs`)
   - Accept PDF path/buffer.
   - Compute SHA-256 hash.
   - Run `acroformPdf.mjs`: extract field list (name, type, page, bbox, default, options, required, max length).
   - Extract page text + headings + numbered question groups for context.

2. **Enrich** (`llmEnricher.mjs`)
   - Send field list + adjacent text to Claude (use Anthropic SDK + prompt caching).
   - Receive: cleaned label, hint, classification (textInput / radioButton / address / etc.), grouping into pages/sections, suggested validations.
   - Token budget cap per import; retries bounded; cache common form regions across runs.

3. **Classify** (`classify.mjs`)
   - Fingerprint form (form number from header, OMB number, title hash).
   - Match against standard VA patterns (claimant identity block, contact block, evidence upload block) via the corpus.
   - High-fingerprint matches use known mapping templates; novel forms use enricher output.

4. **Score** (`confidence.mjs`)
   - Per-component confidence = weighted combo of: AcroForm signal strength, label-distance match, classification certainty from enricher, corpus exemplar similarity, validation-rule match.
   - Score range 0.0–1.0 with bands (high ≥0.85, medium ≥0.6, low <0.6).

5. **Stamp provenance** (`pipeline.mjs`)
   - Attach `source` block at form level.
   - Attach `provenance` block per component with `origin: pdf-field`, `pdfFieldName`, `pdfPage`, `bbox`, `confidence`, `reviewed: false`, `lastCorrectedBy: null`.
   - Apply `runMigrations` to land on the current schema version.

6. **Emit** (CLI + browser)
   - Write `examples/<form-id>/<form-id>-authoring.json`.
   - Write `examples/<form-id>/source.pdf` sidecar.
   - Pass to `validateAuthoringForm` and `compileAuthoringForm` for round-trip verification.

### Review UX flow

- On import completion, builder opens `ImportWizard.tsx`:
  - Walks low-confidence components (band <0.6) and form-level decisions (page grouping, classification).
  - Each step shows the relevant PDF region (`PdfSourcePreview.tsx`) + the importer's guess + accept/reject/edit.
  - Wizard skipped if every component is high-confidence.
- After wizard close, normal builder canvas shows `ConfidenceBadge` on every component until reviewed.
- `ImportReviewPanel.tsx` tab shows remaining unreviewed components ranked by confidence ascending, with counter on the tab.
- Every accept/reject/edit appends to the local corrections corpus.

### Learning loop

- Corrections corpus row shape:
  ```
  {
    "exemplarId": "uuid",
    "pdfFieldName": "VeteranLastName",
    "pdfFieldType": "Tx",
    "neighborText": ["Last name of Veteran"],
    "componentTypeBefore": "textInput",
    "componentTypeAfter": "textInput",
    "labelBefore": "Veterans Last Name",
    "labelAfter": "Veteran's last name",
    "validationsAfter": [...],
    "formFingerprint": "21-526EZ",
    "createdAt": "...",
    "createdBy": "..."
  }
  ```
- `exemplars.mjs` provides nearest-neighbor lookup keyed on `pdfFieldName` + `neighborText` (token-set similarity initially; embeddings later).
- Importer consults corpus before LLM enrichment; corpus hits short-circuit and lift confidence score.
- Builder UI offers "Export corrections" / "Import corrections" actions for manual share, mirroring the saved-template export/import pattern already in `FormActions.tsx`.

### Standards layer flow

- Each source emits a normalized rule list:
  ```
  {
    "id": "va.standards.intro-page-required",
    "scope": "form",
    "severity": "warning|error",
    "rule": { ...declarative shape... },
    "message": "...",
    "source": "builtIn|vetsWebsiteScrape|uswdsDocs|external",
    "version": "...",
    "fixHint": "..."
  }
  ```
- `priority.mjs` resolves overlapping `id`s using the configured priority order; later overrides earlier; conflicts surface in the audit panel with the source + version that won.
- `audit.mjs` runs every active rule against the authoring form and returns `{pass, warnings[], blockers[]}` keyed by rule id + component id.
- `StandardsAuditPanel.tsx` groups results by source + severity, with a "view rule definition" affordance.
- VA.gov export gate consults `audit.mjs` and surfaces warnings in the export dialog. No hard block; author acknowledges and proceeds.

### Schema additions

Add to `src/schema/authoring-schema.json`:

- Form-level `source`:
  ```
  "source": {
    "kind": "pdf|normalizedForm|manual|scraped",
    "uri": "examples/21-526EZ/source.pdf",
    "hash": "sha256:...",
    "importedAt": "2026-04-25T...",
    "importedBy": "user-id"
  }
  ```
- Form-level `lineage`:
  ```
  "lineage": {
    "schemaVersion": "1.0.0",
    "formDefinitionVersion": 1,
    "previousVersion": null,
    "createdFromVersion": null,
    "schemaHash": "sha256:..."
  }
  ```
- Per-component `provenance`:
  ```
  "provenance": {
    "origin": "pdf-field|template|hand-authored",
    "pdfFieldName": "...",
    "pdfPage": 3,
    "bbox": [x, y, w, h],
    "confidence": 0.84,
    "reviewed": false,
    "lastCorrectedBy": null,
    "exemplarId": null
  }
  ```

## Critical Files to Modify or Create

- `src/import/pipeline.mjs` — **NEW**, orchestrator
- `src/import/adapters/acroformPdf.mjs` — **NEW**, deterministic extractor
- `src/import/adapters/llmEnricher.mjs` — **NEW**, Claude API enricher (uses prompt caching)
- `src/import/classify.mjs` — **NEW**, form fingerprint + pattern matching
- `src/import/confidence.mjs` — **NEW**, score helpers
- `src/import/corpus/corrections.jsonl` — **NEW**, seed corpus
- `src/import/corpus/exemplars.mjs` — **NEW**, nearest-neighbor lookup
- `src/import/review.mjs` — **NEW**, wizard payload + review queue
- `src/standards/sources/*.json` — **NEW**, source data
- `src/standards/sources/external.config.mjs` — **NEW**, configurable governance source
- `src/standards/priority.mjs` — **NEW**, configurable resolver
- `src/standards/refresh.mjs` — **NEW**, manual sync
- `src/standards/audit.mjs` — **NEW**, conformance check
- `src/schema/authoring-schema.json` — extend with `source`, `lineage`, per-component `provenance`
- `src/schema/migrations/registry.mjs` — **NEW**, version → migrator map
- `src/schema/migrations/v1-to-v2.mjs` — **NEW**, no-op anchor
- `src/cli/import.mjs` — **NEW**, CLI: PDF in → authoring JSON + sidecar
- `src/cli/refreshStandards.mjs` — **NEW**, manual standards sync
- `apps/builder/src/components/ImportWizard.tsx` — **NEW**
- `apps/builder/src/components/ConfidenceBadge.tsx` — **NEW**
- `apps/builder/src/components/ImportReviewPanel.tsx` — **NEW**
- `apps/builder/src/components/StandardsAuditPanel.tsx` — **NEW**
- `apps/builder/src/components/PdfSourcePreview.tsx` — **NEW**
- `apps/builder/src/lib/importClient.ts` — **NEW**, browser-side wrapper
- `apps/builder/src/lib/reviewState.ts` — **NEW**, per-component review state
- `apps/builder/src/components/FormActions.tsx` — add Import PDF + Export/Import corrections actions
- `apps/builder/src/lib/formModel.ts` — extend types (`source`, `provenance`, `lineage`)
- `apps/builder/src/types.ts` — extend types
- `tests/import.test.mjs` — **NEW**, round-trip + golden snapshot
- `tests/standards.test.mjs` — **NEW**, source merge + priority + audit
- `tests/migrations.test.mjs` — **NEW**, migrator framework
- `tests/builder-smoke.mjs` — extend with import flow + review wizard click-through
- `package.json` — add `pdfjs-dist`, `pdf-lib`, `@anthropic-ai/sdk` deps; add `npm run import`, `npm run standards:refresh`

## Reused Existing Pieces

- `compileAuthoringForm` + `validateAuthoringForm` (`src/compiler/authoringCompiler.mjs`) — round-trip verification after import.
- `componentRegistry.mjs` — target component types for classification output.
- `componentSystems.mjs` — pre-import validation that classified types are supported.
- `diffAuthoringForms` (`src/audit/diff.mjs`) — pairs with standards audit; surfaces version-vs-version + version-vs-standards in the same panel.
- `runnerFlow.js` + `runnerValidation.js` — imported form runs in builder runner immediately after import; validates schema + rules end-to-end.
- `FormActions.tsx` saved-template export/import pattern — same UX for corrections corpus share.
- `OutputPanel.tsx` per-file preview pattern (introduced in export plan) — re-used for showing imported authoring JSON + sidecar PDF preview.

## Verification

- `npm test` — must pass; new tests:
  - `tests/import.test.mjs`: import a fixture AcroForm PDF, assert authoring JSON validates, every component has `provenance` with confidence in [0, 1], deterministic adapter output is byte-identical across two runs (LLM enricher mocked).
  - `tests/standards.test.mjs`: feed a sample form through `audit.mjs`, assert priority resolution chooses the configured top source on conflict, conflicts surfaced in result.
  - `tests/migrations.test.mjs`: load a v1 form, run `runMigrations`, assert lands on current version + schema validates.
- `node src/cli/import.mjs ./fixtures/21-526EZ.pdf --out examples/21-526EZ` — produces `examples/21-526EZ/21-526EZ-authoring.json` + `examples/21-526EZ/source.pdf`. Loads in builder identically to existing examples.
- `node src/cli/refreshStandards.mjs` — pulls + writes `src/standards/sources/vetsWebsiteScrape.json` and `src/standards/sources/uswdsDocs.json`. Diff inspectable in PR.
- `npm run builder:build` — type-check passes after schema + UI additions.
- `npm run builder:smoke` — extended Playwright script imports fixture PDF, walks wizard, accepts a low-confidence component, confirms confidence badge clears, runs the form in the runner, exports corrections JSON.
- Manual: import 21-526EZ + 21-4140 fixtures end-to-end. Compare imported authoring JSON against the hand-authored `examples/21-4140-authoring.json` for parity. Compile + export through `form-route-to-va-gov.md` pipeline. Confirm runner + review + mock submit succeed.

## Out of Scope for This Plan

- Flat/scanned PDF + OCR support — V2.
- Backend learning service or shared corpus sync — local-only for V1.
- Embedding-based exemplar similarity — start with token-set, upgrade later.
- Scheduled background refresh of standards sources — manual CLI now.
- Hard export blocks for non-VA forms — explicit decision: warn only.
- Pluggable export targets beyond VA.gov + generic — covered separately if needed.
- Backend draft/version storage (research plan Artifact 4) — separate plan.
- Submitted/PDF display template generation — explicitly out of MVP.

## Sequencing Suggestion (when execution greenlit)

1. Schema additions + migration framework skeleton (smallest blast radius, unblocks everything else).
2. Standards source format + `audit.mjs` + `priority.mjs` + built-in source seed (no UI yet, exposed via test).
3. AcroForm deterministic adapter + CLI import (no LLM yet, just field extraction with low confidence on every component).
4. LLM enricher + corpus + nearest-neighbor lookup.
5. Builder UI: ConfidenceBadge → ImportReviewPanel → ImportWizard → PdfSourcePreview → StandardsAuditPanel.
6. Refresh scripts + governance config.
7. Smoke + golden-snapshot tests across both example PDFs.
8. Wire VA.gov export gate to consume `audit.mjs` warnings.
