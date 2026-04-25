# VA Form Builder Resume Notes

Last updated: 2026-04-25 EDT after PDF import + standards V1 + UX restructure

## Current Workspace

The standalone VA Form Builder lives at:

`/Users/clint/Workspace/va/form-builder`

Use this workspace first when resuming. There is also a stale duplicate at
`/Users/clint/Workspace/va/va-form-builder` — ignore it. The canonical direction
is a standalone low-code VA.gov form authoring tool that keeps authoring JSON
as the source of truth and generates VA `formConfig` as an output artifact.

## Snapshot

- 98 tests total: 96 passing, 2 gated (skipped without `IMPORT_RUN_OLLAMA_TESTS=1` or `ANTHROPIC_API_KEY + IMPORT_RUN_CLOUD_TESTS=1`).
- `npm run builder:build` green.
- `npm run compile:example` and `npm run compile:example:27-8832` produce valid output.
- Pilot smoke confirmed: real `VBA-27-8832-ARE.pdf` imports end-to-end via local Ollama (`llama3.1:8b`, ~18 min on CPU). Output schema valid, type mix improves over deterministic-only.
- Two design plans live in repo root:
  - `pdf-import-and-standards.md` — V1 fully implemented (M1–M8).
  - `form-route-to-va-gov.md` — drafted, not yet executed.

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

### `pdf-import-and-standards.md` (V1 complete)

PDF AcroForm → authoring JSON pipeline shipped. V1.5/V2 backlog still open:

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

1. **Execute `form-route-to-va-gov.md`** — closes the deployable-output gap. Last V1 piece.
2. **Radio-widget dedup + prompt cleanup in importer** — smallest pilot quality win for next form imports.
3. **Backend / persistence (research-plan Artifact 4)** — drafts, versions, audit logs, baselines beyond localStorage. Larger scope.

## Suggested First Files To Read Next Session

- `pdf-import-and-standards.md`
- `form-route-to-va-gov.md`
- `src/import/pipeline.mjs`
- `src/import/build.mjs`
- `src/standards/index.mjs`
- `apps/builder/src/components/HeaderStrip.tsx`
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
