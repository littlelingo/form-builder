# VA Form Builder Resume Notes

Last updated: 2026-04-25 EDT after next-risk corpus target matrix expansion

## Current Workspace

The standalone VA Form Builder lives at:

`/Users/clint/Workspace/va/form-builder`

Use this workspace first when resuming. There is also a stale duplicate at
`/Users/clint/Workspace/va/va-form-builder` — ignore it. The canonical direction
is a standalone low-code VA.gov form authoring tool that keeps authoring JSON
as the source of truth and generates VA `formConfig` as an output artifact.

## Snapshot

- 129 tests total: 127 passing, 2 gated (skipped without `IMPORT_RUN_OLLAMA_TESTS=1` or `ANTHROPIC_API_KEY + IMPORT_RUN_CLOUD_TESTS=1`).
- `npm run builder:build` green.
- `npm run compile:example` and `npm run compile:example:27-8832` produce valid output.
- Pilot smoke confirmed: real `VBA-27-8832-ARE.pdf` imports end-to-end via local Ollama (`llama3.1:8b`, ~18 min on CPU). Output schema valid, type mix improves over deterministic-only.
- Browser smoke confirmed: `tests/fixtures/pilot/VA9-2020.pdf` imports into builder state with 4 sections, 17 fields, semantic screens, populated Canvas, Review 17 wizard, Accept all, and Promote recipe.
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
- Added a native curation stage in `src/import/curation/` that is generic and data-driven. It can group imported fields into semantic builder chapters/pages from caller-provided recipes or corpus exemplar metadata, and records curation provenance in component provenance.
- Added `curation` progress/report data to `src/import/pipeline.mjs`; `src/import/build.mjs` now respects field curation annotations and keeps uncurated fields in a `Needs review` fallback chapter.
- Added importer tests for recipe-driven and corpus-driven curation. No form-family workflow is hard-coded in JavaScript; `src/import/curation/catalog.json` is an empty data catalog placeholder.
- Formalized the recipe catalog contract with `src/import/curation/recipe-catalog.schema.json` and runtime validation/store APIs in `src/import/curation/recipes.mjs`.
- Recipe storage now mirrors the corpus pattern: seeded `catalog.json` plus runtime `appendRecipe` / `appendRecipes`, `exportRecipeCatalog`, duplicate-ID checks, validation of regex selectors, and explicit rejection of reserved component identity/provenance overrides.
- Added `tests/curation.test.mjs` for catalog validation, runtime import/export, duplicate handling, and default use by `curateFields`.
- Added VA9 recipe data in `src/import/curation/catalog.json` for the appeal workflow. This is data, not a JavaScript form-family branch.
- Added `tests/import-va9.test.mjs`, gated by `tests/fixtures/pilot/VA9-2020.pdf`, `VA9_PDF_PATH`, or `/Users/clint/Downloads/va9_2020.pdf`, that imports the real static VA9 PDF and asserts the curated appeal chapters/pages and key conditional fields.
- VA9 direct import now validates and applies recipe curation to the 17 inferred static-text components. This is the first curated regression target; quality improvements still belong in recipe/corpus data and generic extraction logic.
- Copied VA9 to repo-local ignored fixture `tests/fixtures/pilot/VA9-2020.pdf`; `tests/import-va9.test.mjs` now prefers this local fixture before falling back to `VA9_PDF_PATH` or Downloads. Real pilot PDFs remain ignored by `.gitignore`.
- Playwright UI smoke on `http://localhost:5173/` imported the repo-local VA9 fixture and showed sections/screens: Veteran identification, Relationship and contact information, Issues on appeal, Why VA decided incorrectly, Board hearing selection, Appeal signature, Representative signature. The only browser console error was the existing missing `favicon.ico`; PDF.js font warnings logged but did not block import.
- Added review-to-recipe promotion utilities in `src/import/curation/fromAuthoring.mjs`. Reviewed imported components can now be promoted into a validated recipe or single-recipe catalog without hard-coded form-family logic.
- Added curation recipe import/promote/export controls to the builder Review panel. The panel stays reachable after all imported components are accepted so recipe promotion can happen after review.
- Success-state import progress now renders inline instead of as a fixed overlay, so it no longer blocks Review panel actions after import completes.
- Copied the user's 21-0958 Notice of Disagreement PDF to the ignored repo-local pilot fixture path `tests/fixtures/pilot/VA-21-0958-NOD-2020.pdf`.
- Added generic AcroForm consolidation in `src/import/heuristic/consolidate.mjs` and wired it into `src/import/pipeline.mjs`. It merges split date, SSN, phone, address, name, and radio-widget fragments before enrichment/build.
- Added generic static numbered-label inference in `src/import/extract/staticText.mjs` for PDFs with no usable AcroForm fields. The 21-0958 PDF now imports as 14 valid builder components, including SSN/date/address/phone/email classification and a Board review option radio group.
- Improved radio option grouping without form-specific JavaScript: branch/component/character/relationship/yes-no option sets are inferred from nearby text and option labels. 27-8832 now imports deterministically as 42 valid components instead of the previous noisier 90+ raw-widget-style output.
- Added regression tests in `tests/consolidate.test.mjs` and `tests/import-nod.test.mjs`.
- Added checked-in 21-0958 curation recipe data in `src/import/curation/catalog.json`. The 21-0958 static-text import now matches all 14 fields into builder-native sections/pages: Claimant information, Appeal details, and Certification. Labels, hints, issue text area, and Board review radio options are cleaned by recipe data rather than form-specific JavaScript.
- Tightened `tests/import-nod.test.mjs` to assert the 21-0958 recipe id, all-field match count, curated chapter structure, cleaned labels, masked SSN type, and Board review option labels.
- Added `src/cli/import-corpus.mjs` and `npm run import:corpus` for batch-importing a folder of PDFs into a JSON + Markdown quality report. Default output is `build/import-corpus-report.{json,md}`, and `build/` is ignored.
- Ran the first full sweep over `/Users/clint/Workspace/va/form-samples` (22 PDFs). All 22 imported without crashing: 11 AcroForm/XFA-backed, 11 static-text, 2 curated by seed recipes, 20 generic fallback, 2359 total components after cleanup.
- Fixed static-PDF coverage and label-quality gaps in `src/import/extract/staticText.mjs`: pages with Privacy Act/respondent-burden language are no longer skipped when they also contain several numbered fields; numbered parsing no longer treats embedded years/form numbers such as `1974` or `180` as field numbers; suffix-only groups such as `9A/9B/9C` now become named subfields instead of fake `Item 9` radio groups; obvious instruction/help/legal labels are filtered. This turned three previously empty imports into valid drafts: 21-22a, 21-4142, and 21-4192. Added a synthetic regression for mixed instruction + field pages and suffix-only groups in `tests/import.test.mjs`.
- Added an import quality ladder to `src/cli/import-corpus.mjs`: `raw`, `valid`, `structured`, `builder-native`, and `curated`, plus a representative target matrix for VA9, 10-10EZ, 21-526EZ, SF-180, and 21-4142. The report now distinguishes successful import coverage from builder-shaped conversion quality.
- Added generic semantic page/chapter inference in `src/import/heuristic/segment.mjs` using field labels/names to infer categories such as Veteran information, Contact information, Claim information, Military service, Medical information, Employment information, Financial information, Education and training, and Authorization and signature. This moves many generic imports out of the one-chapter `Imported form` shape without form-specific JavaScript recipes.
- Latest corpus result over the 22 sample PDFs: 22/22 ok, 2356 components, 2 curated, 2 builder-native, 14 structured, 4 valid, 0 raw/failed. Representative targets met: 5/10: baseline set 5/5, next-risk set 0/5.
- Added generic compact repeated-group detection for provider/treatment rows in `src/import/heuristic/segment.mjs`. The importer now collapses repeated 21-4142 provider rows into a `listLoop` chapter named `Treatment providers` with one provider detail page. `src/import/build.mjs` preserves `listLoop` chapter metadata from segmentation so imported repeatable groups compile through the existing array-builder path. The detector is intentionally capped at small prototype groups to avoid over-collapsing large XFA forms.
- Added generic SF-180-style static label cleanup and confidence improvements. Static extraction now shortens prose-heavy labels such as purpose, authorization signature, and requester relationship; treats obvious `NO YES` questions as `yesNo`; avoids classifying `Place of birth` as a date; and gives bounded numbered static labels enough confidence to avoid low-confidence review solely because they came from visible text. The real SF-180 target now imports as builder-native with no long labels, no duplicates, and no low-confidence components.
- Expanded the representative corpus target matrix in `src/cli/import-corpus.mjs` from 5 baseline targets to 10 total targets. The original baseline set remains green, and the new `next-risk` set is DD-293, VA Form 95, 21-8940, 21P-527EZ, and 21P-534EZ. The report now shows target set, current level, target level, and gaps for each target.

Verified after these changes:

```bash
npm test -- tests/import.test.mjs
npm run builder:build
node --input-type=module -e "import { readFile } from 'node:fs/promises'; import { importPdf } from './src/import/pipeline.mjs'; const bytes = await readFile('/Users/clint/Downloads/va9_2020.pdf'); const result = await importPdf(bytes, { filename: 'va9_2020.pdf', enrich: false }); console.log(result.importReport);"
```

Most recent verification:

```bash
npm test -- tests/consolidate.test.mjs tests/import-nod.test.mjs tests/import.test.mjs   # script ran full node suite: 118 pass, 2 gated skips
npm run builder:build
node --input-type=module -e 'import { readFile } from "node:fs/promises"; import { importPdf } from "./src/import/pipeline.mjs"; for (const file of ["tests/fixtures/pilot/VA-21-0958-NOD-2020.pdf","tests/fixtures/pilot/VBA-27-8832-ARE.pdf"]) { const bytes=await readFile(file); const { form, importReport }=await importPdf(bytes,{ filename:file.split("/").pop(), enrich:false }); const comps=form.chapters.flatMap(ch=>ch.pages.flatMap(pg=>pg.components)); console.log(file, JSON.stringify({ componentCount: importReport.componentCount, valid: importReport.validation.valid, labels: comps.slice(0, 18).map(c=>`${c.label} [${c.type}]`) })); }'
```

Browser smoke used `npm run builder:dev` at `http://localhost:5175/` to import
`tests/fixtures/pilot/VA-21-0958-NOD-2020.pdf`; result: 1 section, 14 fields,
valid import status, Canvas populated, Outline populated, Review 14 panel and
wizard opened. Console had the existing missing `favicon.ico` error plus PDF.js
font warnings; neither blocked import.

Latest browser smoke used `npm run builder:dev` at `http://localhost:5173/` to
import `tests/fixtures/pilot/VA-21-0958-NOD-2020.pdf` after the curation recipe
landed. Result: 3 sections, 14 fields, valid import status, Canvas populated,
Outline grouped into Veteran information, Claimant contact information, Board
review selection, Issues on appeal, and Appeal signature, plus Review 14 panel
and wizard with cleaned labels/hints. Console still had only the existing
missing `favicon.ico` error and PDF.js font warnings.

Latest verification:

```bash
npm test -- tests/import-nod.test.mjs tests/curation.test.mjs   # script ran full node suite: 118 pass, 2 gated skips
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
```

Latest corpus verification:

```bash
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm test -- tests/import-corpus.test.mjs   # script ran full node suite: 127 pass, 2 gated skips
node --input-type=module - <<'NODE'
import { readFile } from 'node:fs/promises';
import { importPdf } from './src/import/pipeline.mjs';
import { validateAuthoringForm, compileAuthoringForm, generateVaFormConfigModule } from './src/index.mjs';
const bytes = await readFile('../form-samples/standard-form-180_2020.pdf');
const { form, importReport } = await importPdf(bytes, { filename: 'standard-form-180_2020.pdf', enrich: false });
console.log({
  valid: validateAuthoringForm(form).valid,
  importValid: importReport.validation.valid,
  labels: form.chapters.flatMap(chapter => chapter.pages.flatMap(page => page.components.map(component => `${component.label} [${component.type}] ${component.provenance.confidence}`))),
  generatedHasConfig: generateVaFormConfigModule(form).includes('const formConfig'),
  compiledChapterTypes: compileAuthoringForm(form).chapters.map(chapter => chapter.type),
});
NODE
```

Previous verification:

```bash
npm test -- tests/reviewState.test.mjs tests/curation.test.mjs   # script ran full node suite: 115 pass, 2 gated skips
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
```

Browser smoke used `npm run builder:dev` and Playwright at `http://localhost:5174/` (5173 was occupied) to import `tests/fixtures/pilot/VA9-2020.pdf`; result: 4 sections, 17 fields, semantic outline, Canvas populated, Review 17 panel, wizard Step 1 of 17. After closing the wizard, `Accept all` left the Review tab available with zero outstanding items, and `Promote recipe` reported 17 reviewed fields promoted. A second import confirmed the inline success panel no longer intercepts `Accept all`.

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

- Harden native curation: raw extraction now flows through a validated, data-driven curation stage. VA9 has seed recipe data; additional reviewed forms still need recipe/corpus data.
- VA9 regression target: `/Users/clint/Downloads/va9_2020.pdf` now drives a curated structural regression test. Next quality pass should exercise it in the builder UI and then tighten recipe/generic extraction data from what the review panel reveals.
- Recipe layer: known form families (VA9, 27-8832, future forms) should improve generic imports without requiring every converted form to live in `examples/`. Keep recipes/corpus data-driven and reviewable.
- Continue hardening generic import quality: some 27-8832 duplicate/low-value residual fields remain, especially checkbox/email-consent artifacts and claimant identification leftovers.
- Prompt update to strip PDF parenthetical artifacts ("(SSN)", "(MM-DD-YYYY)") for optional enrichment paths.
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

1. **Use the quality ladder and target matrix as the main improvement loop** — run `npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md`, inspect representative target gaps first, and move forms upward one level at a time instead of treating 22/22 successful imports as quality.
2. **Move the static next-risk targets to `structured`** — DD-293, VA Form 95, and 21-8940 currently import as `valid` because they still fall back to generic structure. Start with VA Form 95 or DD-293 and add the smallest generic segmentation/static-label improvement that moves at least one target to `structured`.
3. **Move large pension XFA targets to `builder-native`** — 21P-527EZ and 21P-534EZ are `structured` but not builder-native because they still have duplicate/long-label gaps. Improve duplicate-label handling and repeated-group detection conservatively so large XFA forms are not over-collapsed.
4. **Promote builder-native targets to curated** — SF-180 and 21-4142 are builder-native but still generic fallback. Add reviewed recipe/corpus data only after the generic shapes are stable.
5. **Harden AcroForm/XFA semantic grouping** — 10-10EZ and 21-526EZ meet the first `structured` target, but high-volume forms still need better chapter grouping, duplicate-label handling, and eventual recipe/corpus promotion before they are builder-native.
6. **Later: execute `form-route-to-va-gov.md`** — still useful, but PDF curation quality is now the active priority.

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
