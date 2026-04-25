# VA Form Builder Resume Notes

Last updated: 2026-04-25 EDT after PDF import status UI, static PDF fallback, and curated-import direction

## Current Workspace

The standalone VA Form Builder lives at:

`/Users/clint/Workspace/va/form-builder`

Use this workspace first when resuming. There is also a stale duplicate at
`/Users/clint/Workspace/va/va-form-builder` — ignore it. The canonical direction
is a standalone low-code VA.gov form authoring tool that keeps authoring JSON
as the source of truth and generates VA `formConfig` as an output artifact.

## Snapshot

- 100 tests total: 98 passing, 2 gated (skipped without `IMPORT_RUN_OLLAMA_TESTS=1` or `ANTHROPIC_API_KEY + IMPORT_RUN_CLOUD_TESTS=1`).
- `npm run builder:build` green.
- `npm run compile:example` and `npm run compile:example:27-8832` produce valid output.
- Pilot smoke confirmed: real `VBA-27-8832-ARE.pdf` imports end-to-end via local Ollama (`llama3.1:8b`, ~18 min on CPU). Output schema valid, type mix improves over deterministic-only.
- Browser smoke confirmed: `/Users/clint/Downloads/va9_2020.pdf` imports into builder state with 17 inferred static-text components, Outline populated, Canvas loaded, and import review wizard open.
- Two design plans live in repo root:
  - `pdf-import-and-standards.md` — V1 fully implemented (M1–M8).
  - `form-route-to-va-gov.md` — drafted, not yet executed.

## Current PDF Import Direction

The user clarified that every PDF import/conversion should try to produce a **builder-native curated draft** directly in builder state, not a raw field dump and not a PDF replica. Examples are useful as gold-standard fixtures, recipes, demos, and corpus seeds, but normal product flow should be:

`Select PDF -> import/convert -> load curated draft into builder state -> review/edit -> save/export authoring JSON`

The importer should treat raw extraction as an internal stage only. The default import pipeline should always attempt:

- form family/title/fingerprint detection,
- semantic grouping into chapters/pages,
- stable human-readable IDs,
- clean labels, hints, options, required flags, validations, and conditions,
- merging fragmented PDF widgets/static regions into semantic builder components,
- confidence/provenance for review,
- recipe/corpus use when known, with generic curation fallback when unknown.

The 27-8832 example is the quality model: the source PDF drove the conversion, but the saved result is a curated builder-native authoring form. VA9 should be the first regression target for making that curated stage native to all imports.

Recent implementation already completed:

- Fixed browser PDF.js worker setup via `apps/builder/src/lib/pdfjsWorker.ts`.
- Added prominent PDF import progress/status UI in `HeaderStrip.tsx` and `styles.css`.
- Added progress events through `src/import/pipeline.mjs` and page-level text extraction.
- Added static text fallback in `src/import/extract/staticText.mjs`.
- Added `pdf-static-region` provenance support in schema and builder types.
- Updated successful import behavior to switch to Canvas/Edit/Outline and open review for low-confidence imported components.
- VA9 direct import now validates and produces 17 low-confidence draft components from static text. This is a safety-net draft, not yet the complete curated end state.

Verified after these changes:

```bash
npm test -- tests/import.test.mjs
npm run builder:build
node --input-type=module -e "import { readFile } from 'node:fs/promises'; import { importPdf } from './src/import/pipeline.mjs'; const bytes = await readFile('/Users/clint/Downloads/va9_2020.pdf'); const result = await importPdf(bytes, { filename: 'va9_2020.pdf', enrich: false }); console.log(result.importReport);"
```

Browser smoke used `npm run builder:dev` and Playwright to import `/Users/clint/Downloads/va9_2020.pdf`; result: 17 fields in summary, Outline selected, Canvas populated, Review 17 panel, wizard Step 1 of 17.

## V1 Milestones — Done

| M | Subsystem | Files |
|---|-----------|-------|
| M1 | Schema 1.0.0 → 1.1.0 + migrations + retro-stamp | `src/schema/migrations/`, `tests/migrations.test.mjs` |
| M2 | Standards predicate DSL + audit + builtIn.json | `src/standards/`, `tests/standards.test.mjs` |
| M3 | Deterministic AcroForm importer + CLI | `src/import/extract/`, `src/import/heuristic/`, `src/import/build.mjs`, `src/import/pipeline.mjs`, `src/cli/import.mjs`, `tests/import.test.mjs`, `tests/import-pilot.test.mjs` |
| M4 | ConfidenceBadge + Import PDF + reviewState | `apps/builder/src/components/ConfidenceBadge.tsx`, `apps/builder/src/lib/{importClient.ts,reviewState.ts}` |
| M5 | LLM enricher (provider-abstracted, Ollama default) | `src/import/llm/`, `docs/import-llm-providers.md`, `tests/llm.test.mjs` |
| M6 | Corrections corpus + nearest-neighbor + seed | `src/import/corpus/`, `tests/corpus.test.mjs` |
| M7 | Import wizard + review panel | `apps/builder/src/components/{ImportWizard,ImportReviewPanel}.tsx`, `tests/wizardSteps.test.mjs` |
| M8 | Standards audit panel | `apps/builder/src/components/StandardsAuditPanel.tsx` |

## UX restructure — Done

- New top-row HeaderStrip: `+ New`, `📂 Open JSON`, `💾 Save *` (dirty-aware), `📄 Import PDF`, then canvas controls (Undo/Redo, Edit/Preview, Canvas/Run/Code, Preview-system dropdown), then `More ▾` overflow.
- localStorage persistence: `va-form-builder.lastForm.v1` + `va-form-builder.lastSaved.v1` (signature for dirty detection). Reload restores last-saved form.
- Files panel slimmed to Examples + saved templates only. Inline reload icon on currently-loaded example.
- Demoted actions:
  - `Set as baseline` → `AuditPanel` header
  - `Import / Export corrections` → `ImportReviewPanel` footer
- Tab strips lighter (toolbox + inspector + segmented controls): font 0.7rem weight 600, subtle ink-tint active state instead of solid fill.
- BuilderToolbar component still in repo but no longer rendered (HeaderStrip absorbed it). Safe to delete.

## Verified Commands

Run from `/Users/clint/Workspace/va/form-builder`:

```bash
npm test
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
npm run builder:smoke

# Importer
node src/cli/import.mjs <pdf> --out ./build/<form-id>
node src/cli/import.mjs <pdf> --out ./build/<form-id> --form-id=21-526EZ

# Corpus seed (regenerate from examples/*.json)
npm run corpus:seed

# Local LLM (Ollama via Docker)
npm run llm:up
npm run llm:status
npm run llm:pull          # llama3.1:8b
npm run llm:pull:qwen     # qwen2.5:14b
IMPORT_LLM_PROVIDER=ollama IMPORT_LLM_MODEL=llama3.1:8b node src/cli/import.mjs <pdf> --out <dir>

# Gated tests
IMPORT_RUN_OLLAMA_TESTS=1 npm test
ANTHROPIC_API_KEY=sk-ant-... IMPORT_RUN_CLOUD_TESTS=1 npm test
```

## Active Plans

### `pdf-import-and-standards.md` (V1 complete, curated-import contract added)

PDF AcroForm → authoring JSON pipeline shipped. V1.5/V2 backlog still open:

- Native curation stage for every PDF import: raw extraction should flow through semantic grouping/normalization before the form is loaded into builder state.
- VA9 regression target: use `/Users/clint/Downloads/va9_2020.pdf` to drive the curated-import stage. Current static fallback finds 17 draft components; complete solution should produce a curated appeal workflow.
- Recipe layer: known form families (VA9, 27-8832, future forms) should improve generic imports without requiring every converted form to live in `examples/`.
- Radio-widget dedup in `src/import/extract/pair.mjs` (BranchOfService currently emits one component per option).
- Prompt update to strip PDF parenthetical artifacts ("(SSN)", "(MM-DD-YYYY)").
- Real `vetsWebsiteScrape.json` scraper for the standards layer.
- `apps/proxy/` for browser-side LLM enrichment (currently Node CLI only).
- Embedding-based corpus similarity (replace token-set Jaccard).
- OCR fallback for scanned PDFs.
- Pilot CPU run optimization (GPU recommended; ~18 min on CPU per 95-field form).
- Accessibility rules in `src/standards/sources/builtIn.json` (focus order, aria, color contrast).
- Golden snapshot tests on generated `formConfig` output.

### `form-route-to-va-gov.md` (next to execute)

Path A export pipeline. Generate full `vets-website` app folder (`manifest.json`, `app-entry.jsx`, `routes.jsx`, `reducers/index.js`, `config/form.js`, `tests/`, `sass/`, `_authoring/<form-id>.authoring.json`) from a compiled form. CLI `--out` + `--zip` flags. Builder `Export VA.gov app` button. Audit gate before export. PR hand-off deferred.

Estimate: ~half-day execution. Plan is execution-ready; no further design needed.

## Recommended Next Sequence

1. **Implement native PDF curation stage** — add a post-extraction semantic layer that always attempts to return a builder-native curated draft in memory before loading state.
2. **Use VA9 as first curation regression target** — define the target appeal workflow shape from `/Users/clint/Downloads/va9_2020.pdf`, then add structural import-quality assertions that compare the actual imported form to that target.
3. **Add recipe/corpus integration for curated forms** — examples are fixtures/seeds, not the product storage path. Reviewed imports should be exportable from state, and selected curated forms can become recipes/goldens.
4. **Then return to importer quality backlog** — radio-widget dedup, prompt cleanup, address/date/SSN fragment merging, and better generic grouping.
5. **Later: execute `form-route-to-va-gov.md`** — still useful, but PDF curation quality is now the active priority.

## Suggested First Files To Read Next Session

- `pdf-import-and-standards.md`
- `form-route-to-va-gov.md`
- `src/import/extract/staticText.mjs`
- `src/import/pipeline.mjs`
- `src/import/build.mjs`
- `src/import/confidence.mjs`
- `src/standards/index.mjs`
- `apps/builder/src/components/HeaderStrip.tsx`
- `apps/builder/src/components/ImportWizard.tsx`
- `apps/builder/src/App.tsx`
- `tests/import.test.mjs`, `tests/import-pilot.test.mjs`
- `docs/import-llm-providers.md`

## Guardrails

- Authoring JSON is the source of truth. Generated VA `formConfig` is output only.
- Schema migrations are isomorphic + async (Web Crypto subtle.digest). No `node:crypto` in browser bundle.
- LLM enricher is fully optional. Default = local Ollama. Cloud Claude requires explicit `ANTHROPIC_API_KEY` opt-in.
- LLM proxy app for browser-side enrichment is deferred — CLI/server is the supported path until V1.5.
- Provenance + lineage + source live in authoring JSON. Migrator stamps defaults.
- Standards layer is data-driven (`src/standards/sources/builtIn.json`). Multi-source plumbing is in place; only `builtIn` is loaded in V1.
- Browser/Node split: `node:fs`-using modules go through `with { type: 'json' }` static imports or guarded behind `apps/proxy/`. Anthropic SDK is dynamically imported with `/* @vite-ignore */` so it stays Node-only.
- Before handing off, run `npm test`, `npm run builder:build`, `npm run compile:example`, `npm run compile:example:27-8832`.
- Do not treat `examples/` as the product storage destination for every converted form. Normal imports should load into builder state and be saved/exported by the user; examples are for goldens, recipes, demos, and corpus seeding.
