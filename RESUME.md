# VA Form Builder Resume Notes

Last updated: 2026-04-26 EDT after confidence-guidance UX pass and centered import modal behavior

## Current Workspace

The standalone VA Form Builder lives at:

`/Users/clint/Workspace/va/form-builder`

Use this workspace first when resuming. There is also a stale duplicate at
`/Users/clint/Workspace/va/va-form-builder` — ignore it. The canonical direction
is a standalone low-code VA.gov form authoring tool that keeps authoring JSON
as the source of truth and generates VA `formConfig` as an output artifact.

## Snapshot

- 157 tests total: 155 passing, 2 gated (skipped without `IMPORT_RUN_OLLAMA_TESTS=1` or `ANTHROPIC_API_KEY + IMPORT_RUN_CLOUD_TESTS=1`).
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

Repeated-row/list-loop promotion is an import/convert decision for known PDFs. The curation recipe should encode when extracted source fields become a builder-native `listLoop`, so importing the PDF lands directly in the authorable shape instead of requiring a manual post-import transformation.

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
- Import progress/status now stays in a centered overlay panel for running/success/blocked/error states so import outcomes remain visible and explicit before dismissal.
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
- Current corpus result over the 22 sample PDFs: 22/22 ok, 2010 components, 22 curated, 0 builder-native, 0 valid/structured/raw/failed. Representative targets met: 12/12. Remaining review count: 0.
- Added generic compact repeated-group detection for provider/treatment rows in `src/import/heuristic/segment.mjs`. The importer now collapses repeated 21-4142 provider rows into a `listLoop` chapter named `Treatment providers` with one provider detail page. `src/import/build.mjs` preserves `listLoop` chapter metadata from segmentation so imported repeatable groups compile through the existing array-builder path. The detector is intentionally capped at small prototype groups to avoid over-collapsing large XFA forms.
- Added generic SF-180-style static label cleanup and confidence improvements. Static extraction now shortens prose-heavy labels such as purpose, authorization signature, and requester relationship; treats obvious `NO YES` questions as `yesNo`; avoids classifying `Place of birth` as a date; and gives bounded numbered static labels enough confidence to avoid low-confidence review solely because they came from visible text. The real SF-180 target now imports as builder-native with no long labels, no duplicates, and no low-confidence components.
- Expanded the representative corpus target matrix in `src/cli/import-corpus.mjs` from 5 baseline targets to 10 total targets. The original baseline set remains green, and the new `next-risk` set is DD-293, VA Form 95, 21-8940, 21P-527EZ, and 21P-534EZ. The report now shows target set, current level, target level, and gaps for each target.
- Added generic claim/incident and insurance semantic segmentation in `src/import/heuristic/segment.mjs`. The real VA Form 95 static tort-claim PDF now imports as two builder-style chapters, `Claim information` and `Insurance information`, so it moved from `valid` to `structured` and meets its next-risk target.
- Added generic applicant/requester semantic segmentation in `src/import/heuristic/segment.mjs`. The real DD-293 correction-board PDF now imports page 2 as `Applicant information` instead of `Needs review`, so the form moved from `valid` to `structured` and meets its next-risk target.
- Added generic unemployability employment and education/training segmentation in `src/import/heuristic/segment.mjs`. The real 21-8940 TDIU PDF now imports as Veteran information, Employment information, Education and training, and Authorization and signature instead of leaving pages 2 and 3 in `Needs review`, so all three static next-risk targets now meet `structured`.
- Added a generic imported-label normalization pass in `src/import/build.mjs` for AcroForm/XFA imports. It replaces weak or overlong labels with field-name-derived labels and disambiguates remaining duplicate labels with page/occurrence context. This moved 21P-527EZ and 21P-534EZ from `structured` to `builder-native`; the representative target matrix is now 10/10.
- Added checked-in SF-180 curation recipe data in `src/import/curation/catalog.json` and regression coverage in `tests/import-sf180.test.mjs`. The real `standard-form-180_2020.pdf` now imports 12/12 fields as a curated records request workflow with Service member information, Service history, Records request, Requester information, and Authorization chapters.
- Added checked-in VA Form 95 curation recipe data in `src/import/curation/catalog.json` and regression coverage in `tests/import-va95.test.mjs`. The real `va-form-95-tort-claim_2020.pdf` now imports 17/17 fields as a curated tort claim workflow with Claimant information, Incident details, Damages, Signature, and Insurance information chapters.
- Extended curation recipe metadata so recipes can preserve `listLoop` chapter type/options, item-name labels, section intros, and reviewed field order instead of flattening repeatable sections. `createRecipeFromAuthoringForm` now includes those chapter details when promoting reviewed imports.
- Added checked-in VA Form 21-4142 curation recipe data in `src/import/curation/catalog.json` and regression coverage in `tests/import-4142.test.mjs`. The real `va-form-21-4142_2020.pdf` now imports 12/12 extracted static fields into 9 builder components as a curated authorization workflow with Veteran information, Patient information, and a Treatment providers `listLoop`.
- Added generic DD-293-oriented static label cleanup in `src/import/extract/staticText.mjs` for common option-list and instruction/prose tails such as branch/component choices, highest education, applicant signature, support documents, and discharge inequity/impropriety statements. The real `dd-form-293_2020.pdf` now has no overlong labels, no duplicate labels, and moves from `structured` to `builder-native`; `tests/import-dd293.test.mjs` locks the quality level.
- Added generic XFA label cleanup in `src/import/build.mjs` for the compensation-election pattern `Do not pay me VA compensation`. The real `VBA-21-526EZ-ARE.pdf` now has no overlong labels, no duplicate labels, and moves from `structured` to `builder-native`; `tests/import-526ez.test.mjs` locks the large-form quality level.
- Added generic 21-22a static authorization label cleanup in `src/import/extract/staticText.mjs` for protected records access, limitation of consent, claimant address-change authorization, limited one-time representation, and limitations on representation. The real `va-form-21-22a_2020.pdf` now has no overlong labels, no duplicate labels, and moves from `structured` to `builder-native`; `tests/import-2122a.test.mjs` locks the quality level.
- Added generic older VA 21-526 static label cleanup in `src/import/extract/staticText.mjs` for current disability/symptoms, VA or military treatment facilities, compensation-election, separation/severance pay, and no financial institution account labels. The real `va-21-526-application-for-benefits_2020.pdf` now has no overlong labels, no duplicate labels, and moves from `structured` to `builder-native`; `tests/import-21-526.test.mjs` locks the quality level.
- Added generic 21-4192 static employment label/type cleanup in `src/import/extract/staticText.mjs` for earned amount, termination reason, lump-sum payment, military-duty disability, employment-related benefits, and employer/supervisor signature labels. The real `va-form-21-4192-request-for-employment-info_2020.pdf` now has no overlong labels, no duplicate labels, and moves from `structured` to `builder-native`; `tests/import-21-4192.test.mjs` locks the quality level and the corrected textArea/yesNo types.
- Added generic VA5655 static financial-status cleanup in `src/import/extract/staticText.mjs` for bankruptcy and additional-financial-information labels, plus broader financial semantic segmentation in `src/import/heuristic/segment.mjs`. Same-topic semantic pages now merge into one builder chapter, so VA5655 imports as a two-page `Financial information` chapter with no overlong labels and no duplicates; `tests/import-va5655.test.mjs` and expanded segmentation tests lock the behavior.
- Added checked-in curation recipes and regression coverage for VA Form 3288, 21-8940, DD-293, 21-22a, VA5655, 21-4192, and the older 21-526. The current corpus has no remaining `valid`, `structured`, `raw`, or failed imports; the remaining work is promoting generic-fallback `builder-native` forms into curated workflows.
- Added a checked-in curation recipe and regression coverage for VA Form 27-8832. The real `VBA-27-8832-ARE.pdf` now imports as a curated career-guidance workflow with 36/36 consolidated extracted fields matched into Veteran/service member identity, contact, school/training, military service, claimant, remarks, and certification/signature chapters.
- Strengthened generic AcroForm/XFA consolidation for DOB/date-signed naming variants, explicit SSN fragments, identity name families, address-family separation, and row-based phone grouping. This prevents address ZIP fragments from mixing into phone/SSN groups and supports current/new mailing address families used by 28-1900 plus the veteran/claimant field families used by 21-0966.
- Added a checked-in curation recipe and regression coverage for VA Form 28-1900. The real `VBA-28-1900-ARE.pdf` now imports as a curated Veteran Readiness and Employment workflow with 16/16 consolidated fields matched into Claimant identity, Contact information, Change of address, Education, and Certification and signature chapters. The current corpus has 8 remaining generic-fallback `builder-native` forms.
- Added a checked-in curation recipe and regression coverage for VA Form 21-0966. The real `VBA-21-0966-ARE.pdf` now imports as a curated intent-to-file workflow with 32/32 consolidated fields matched into Veteran identity/contact, Claimant identity/contact, Benefit election, and Declaration/signature chapters.
- Added a checked-in curation recipe and regression coverage for VA Form 21P-534a. The real `VBA-21P-534a-ARE.pdf` now imports as a curated in-service death DIC workflow with 51/51 consolidated fields matched into Veteran identity, Claimant identity, Children in custody, Claimant contact information, Direct deposit, Claimant signature, and Casualty Assistance Officer chapters. The current corpus has 6 remaining generic-fallback `builder-native` forms.
- Added date-family consolidation for AcroForm/XFA date fragments so decision-notice date fields can group without mixing with signature or POA-submission dates.
- Added a checked-in curation recipe and regression coverage for VA Form 20-0995. The real `VBA-20-0995-ARE.pdf` now imports as a curated supplemental-claim workflow with 94/94 consolidated fields matched into Benefit type, Veteran/Claimant identity and contact, Homeless information, Issues for supplemental claim, New and relevant evidence, 5103 notice acknowledgment, VHA notification option, Certification/signature, Witnesses, Alternate signer, and Power of attorney chapters. The current corpus has 5 remaining generic-fallback `builder-native` forms.
- Added a checked-in curation recipe and regression coverage for VA Form 10-10EZ. The real `VA Form 10-10EZ.pdf` now imports as a curated health-benefits application workflow with 116/116 consolidated fields matched into Benefit selection, Veteran identity/contact, Military service information, Insurance information, Dependent information, Employment information, Financial disclosure, and Consent/signature chapters. The current corpus has 4 remaining generic-fallback `builder-native` forms.
- Added a checked-in curation recipe and regression coverage for VA Form 21P-535. The real `VBA-21P-535-ARE.pdf` now imports as a curated parent D.I.C. workflow with 204/204 consolidated fields matched across the VA 21P-535 pages and the attached SSA-24 survivors-benefits pages. The current corpus has 3 remaining generic-fallback `builder-native` forms.
- Added a checked-in curation recipe and regression coverage for VA Form 21-526EZ. The real `VBA-21-526EZ-ARE.pdf` now imports as a curated disability-compensation workflow with 313/313 consolidated fields matched into claim type, Veteran identity/contact, change of address, homelessness, toxic exposure, disabilities claimed, treatment, military service, payment, certification, and alternate-signer chapters. The current corpus has 2 remaining generic-fallback `builder-native` forms.
- Added a checked-in curation recipe and regression coverage for VA Form 21P-527EZ. The real `VBA-21P-527EZ-ARE.pdf` now imports as a curated Veterans Pension workflow with 491/491 consolidated fields matched into evidence checklist, Veteran identity/contact, military service, pension, employment, marital history, dependent children, income/assets, medical expenses, direct deposit, certification/signature, alternate signer, care facility worksheet, and in-home care worksheet chapters. The current corpus has 1 remaining generic-fallback `builder-native` form.
- Added a checked-in curation recipe and regression coverage for VA Form 21P-534EZ. The real `VBA-21P-534EZ-ARE.pdf` now imports as a curated survivor benefits workflow with 569/569 consolidated fields matched into evidence checklist, Veteran identity, claimant identity/contact, benefit selection, military service, marital information/history, child of Veteran, D.I.C., special monthly pension/D.I.C., income/assets, medical/final expenses, direct deposit, certification/signature, witnesses, alternate signer, care facility worksheet, and in-home care worksheet chapters. The full 22-form corpus is now curated with no remaining generic-fallback forms.
- Added `tests/import-corpus-roundtrip.test.mjs` as the first final corpus polish guard. It imports all 22 PDFs from `../form-samples`, requires curated recipe provenance, saves/re-opens the generated authoring JSON, validates the re-opened form, compares the preserved builder structure, and verifies each re-opened form can still generate VA `formConfig`. While adding it, cleaned importer output so optional chapter metadata and curation provenance omit absent values instead of carrying explicit `undefined` properties that disappear on JSON export.
- Promoted the clear repeated dependent-child detail rows in VA Form 21P-527EZ into a `listLoop` chapter. The recipe still matches and curates all 491 extracted fields, but the builder representation now has 461 components because the repeated child identity/status rows collapse into one authorable `Dependent child entries` loop with 15 item fields. Ambiguous contribution amount and custodian fields remain flat for now.
- Promoted the clear repeated dependent-child detail rows in VA Form 21P-534EZ into the same `Dependent child entries` `listLoop` pattern. The recipe still matches and curates all 569 extracted fields, but the builder representation now has 537 components because the repeated child identity/status/support rows collapse into one authorable loop with 16 item fields. Dependent count, extra-child question, and custodian fields remain flat.
- Promoted the clear repeated care-provider expense rows in VA Form 21P-527EZ into a `Care provider expenses` `listLoop`. The recipe still matches and curates all 491 extracted fields, but the builder representation now has 425 components because the repeated provider/care/payment/date rows collapse into one authorable loop with 18 item fields. The 21P-534EZ care-provider area was left flat because it only exposes partial date rows.
- Promoted the clear repeated income source H-K rows in VA Form 21P-527EZ into an `Income sources` `listLoop`. The recipe still matches and curates all 491 extracted fields, but the builder representation now has 401 components because the repeated payer/recipient/type/amount rows collapse into one authorable loop with 8 item fields. The malformed `Monthy_Amount` source selector is preserved but mapped to the canonical monthly income amount field instead of remaining a duplicate dollars field.
- Promoted the clear repeated medical expense E-J rows in VA Form 21P-527EZ into a `Medical expenses` `listLoop`. The recipe still matches and curates all 491 extracted fields, but the builder representation now has 346 components because the repeated paid-to/date/recipient/frequency/purpose/amount rows collapse into one authorable loop with 11 item fields. The recipe corrects the bad deterministic inference that treated some cents fields as `date`; the converted builder fields are `textInput`.
- Added visible import-time curation decision summaries. `curateFields` now reports list-loop decisions with source field count, canonical item field count, estimated repeated item count, array path, and recipe/source metadata. The browser import progress panel and import review panel now show which builder-native list loops were applied during PDF conversion, so users can see why known PDFs imported as loops instead of flat fields.
- Added automated builder smoke coverage for the curated-import UX contract. `npm run builder:smoke` now imports `VBA-21P-527EZ-ARE.pdf` when the sample fixture is available and asserts Canvas/Outline population, `curated 491/491`, all four visible list-loop curation decisions, no low-confidence wizard, and Review panel `Imported components (0)`.
- Added shared plain-language low-confidence insight messaging in `apps/builder/src/lib/confidenceInsights.ts` and wired it into `ConfidenceBadge`, `ImportReviewPanel`, `ImportWizard`, and `InspectorPanel`. Low-confidence imported fields now show clear "why this was flagged" summaries plus short "what to check" guidance in non-builder jargon.
- Updated curated-import smoke automation to explicitly accept the multi-form confirmation dialog triggered by current 21P-527EZ form-inventory detection so the import flow continues through the success panel contract.
- Promoted the clear four-row child table in VA Form 21P-534a into a `Children in custody` `listLoop`. The recipe still matches and curates all 51 extracted fields, but the builder representation now has 36 components because the repeated child name/date/SSN/place/relationship rows collapse into one authorable loop with 5 item fields.
- Promoted the clear nine-row issue table in VA Form 20-0995 into an `Issues for supplemental claim` `listLoop`. The recipe still matches and curates all 94 extracted fields, but the builder representation now has 78 components because the repeated specific-issue/VA-decision-notice-date rows collapse into one authorable loop with 2 item fields.
- Promoted the clear three-row treatment-facility table in VA Form 20-0995 into a separate `Treatment facilities` `listLoop`. The recipe still matches and curates all 94 extracted fields, but the builder representation now has 70 components because the repeated facility name/location, treatment month/year, and no-date rows collapse into one authorable loop with 4 item fields.
- Reassessed the next large harvest candidates after the 20-0995 loops. 21-526EZ disabilities are high-value, but the first 15 rows are cleaner than rows 16-35 because the later page group has a shifted/extra `DateBeganOrWorsened2` signal around row 16. 21P-535 SSA service history is not a full four-row loop: rows 1-3 have date entered, service number, date separated, and grade/rank/organization, while row 4 only exposes grade/rank/organization. Validate source-PDF semantics before promoting either as a broad loop.
- Deferred TODO: revisit 21P-534EZ medical/care expenses and marital history only with source-PDF research and validation. The visible rows are shifted, mixed, or incomplete enough that loop promotion should wait until row alignment, labels, and item schema can be proven against the source form.

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

Latest browser smoke used `npm run builder:dev` at `http://localhost:5174/` to
import `../form-samples/VBA-21P-527EZ-ARE.pdf` after curation-decision reporting
landed. Result: 20 sections, 346 fields, valid import status, Canvas and Outline
populated, progress panel showed curation at `curated 491/491`, and the progress
panel listed all four recipe-driven list-loop conversions: Dependent child
entries, Income sources, Care provider expenses, and Medical expenses. The
Review panel also showed the same four decisions under "Applied during PDF
conversion". Console still had only the existing missing `favicon.ico` error,
the expected XFA-removal warning, and PDF.js font warning. This smoke initially
surfaced a review burden gap: the Review wizard opened at `Step 1 of 252` even
though the form was fully matched by recipe curation. That is now fixed:
recipe-curated components no longer count as needing human review by default,
the re-import success message says "Recipe curation matched all 491 source
fields", no wizard opens, and the Review tab shows `Imported components (0)`
while still showing the applied curation decisions.

Latest verification:

```bash
npm test -- tests/import-nod.test.mjs tests/curation.test.mjs   # script ran full node suite: 118 pass, 2 gated skips
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
```

Latest verification after confidence-guidance + centered import modal updates:

```bash
node --test tests/confidence-insights.test.mjs tests/reviewState.test.mjs tests/wizardSteps.test.mjs
npm run builder:smoke
npm run builder:build
```

Latest corpus verification:

```bash
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm test -- tests/import-va5655.test.mjs tests/import-segment.test.mjs tests/import-dd293.test.mjs   # script ran full node suite: 142 pass, 2 gated skips
node --input-type=module - <<'NODE'
import { readFile } from 'node:fs/promises';
import { importPdf } from './src/import/pipeline.mjs';
import { assessImportQuality, qualitySignals } from './src/cli/import-corpus.mjs';
import { validateAuthoringForm } from './src/index.mjs';
const filename = 'va5655_2020.pdf';
const bytes = await readFile(`../form-samples/${filename}`);
const { form, importReport } = await importPdf(bytes, { filename, enrich: false });
const signals = qualitySignals(form, importReport);
const components = form.chapters.flatMap(chapter => chapter.pages.flatMap(page => page.components));
console.log({
  valid: validateAuthoringForm(form).valid,
  importValid: importReport.validation.valid,
  quality: assessImportQuality({ status: 'ok', componentCount: importReport.componentCount, validation: importReport.validation, curation: importReport.curation, qualitySignals: signals }).level,
  veryLongLabels: signals.veryLongLabels,
  duplicateLabels: signals.duplicateLabels,
  componentCount: importReport.componentCount,
  chapters: form.chapters.map(chapter => ({ title: chapter.title, pages: chapter.pages.length })),
  cleanedLabels: components.filter(component => /Bankrupt|Additional Financial/.test(component.label)).map(component => ({ label: component.label, type: component.type })),
});
NODE
npm run builder:build
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
git diff --check
```

Latest verification after VA Form 27-8832 recipe promotion:

```bash
npm test -- tests/import-27-8832.test.mjs tests/curation.test.mjs   # script ran full node suite: 145 pass, 2 gated skips
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm run compile:example:27-8832
git diff --check
```

Latest verification after VA Form 28-1900 recipe promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
npm test -- tests/consolidate.test.mjs tests/import-27-8832.test.mjs tests/import-28-1900.test.mjs tests/import-526ez.test.mjs   # script ran full node suite: 147 pass, 2 gated skips
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm run compile:example:27-8832
npm run builder:build
git diff --check
```

Latest verification after VA Form 21-0966 recipe promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
npm test -- tests/consolidate.test.mjs tests/import-21-0966.test.mjs tests/import-27-8832.test.mjs tests/import-28-1900.test.mjs tests/import-526ez.test.mjs tests/import-pilot.test.mjs   # script ran full node suite: 148 pass, 2 gated skips
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm run compile:example:27-8832
npm run builder:build
git diff --check
```

Latest verification after VA Form 21P-534a recipe promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
node --test tests/import-21p-534a.test.mjs tests/import-21-0966.test.mjs tests/import-27-8832.test.mjs tests/import-526ez.test.mjs
npm test
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm run compile:example
npm run compile:example:27-8832
npm run builder:build
git diff --check
```

Latest verification after VA Form 21P-535 recipe promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
node --test tests/import-21p-535.test.mjs tests/import-10-10ez.test.mjs tests/import-20-0995.test.mjs tests/consolidate.test.mjs tests/import-21-0966.test.mjs tests/import-21p-534a.test.mjs tests/import-27-8832.test.mjs tests/import-28-1900.test.mjs tests/import-526ez.test.mjs tests/import-corpus.test.mjs
npm test
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm run compile:example
npm run compile:example:27-8832
npm run builder:build
git diff --check
```

Latest verification after curated-import smoke automation and 21P-534a child loop promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; console.log(JSON.stringify(validateRecipeCatalog(catalog), null, 2));'
node --test tests/import-21p-534a.test.mjs tests/curation.test.mjs
npm run builder:smoke
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm test
npm run compile:example
npm run compile:example:27-8832
npm run builder:build
git diff --check
```

Latest verification after VA Form 20-0995 issue loop promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; const result = validateRecipeCatalog(catalog); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exit(1);'
node --test tests/import-20-0995.test.mjs tests/curation.test.mjs
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm test
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
git diff --check
npm run builder:smoke
```

Latest verification after VA Form 20-0995 treatment-facility loop promotion:

```bash
node --input-type=module -e 'import catalog from "./src/import/curation/catalog.json" with { type: "json" }; import { validateRecipeCatalog } from "./src/import/curation/recipes.mjs"; const result = validateRecipeCatalog(catalog); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exit(1);'
node --test tests/import-20-0995.test.mjs tests/curation.test.mjs
npm run import:corpus -- ../form-samples --out build/import-corpus-report.json --markdown build/import-corpus-report.md
npm test
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
git diff --check
npm run builder:smoke
```

Additional verification for the review burden fix:

```bash
node --test tests/reviewState.test.mjs tests/wizardSteps.test.mjs
node --test tests/import-21p-527ez.test.mjs tests/reviewState.test.mjs tests/wizardSteps.test.mjs
npm test
npm run builder:build
```

Latest corpus result over the 22 sample PDFs: 22/22 ok, 2010 components, 22 curated, 0 builder-native, 0 valid/structured/raw/failed. Representative targets met: 12/12, including `VBA-20-0995-ARE.pdf`, `VBA-21P-527EZ-ARE.pdf`, `VBA-21P-534a-ARE.pdf`, and `VBA-21P-534EZ-ARE.pdf` at `curated`. Remaining review count: 0.

Current curated forms in the corpus report:

- `dd-form-293_2020.pdf`
- `standard-form-180_2020.pdf`
- `va-21-526-application-for-benefits_2020.pdf`
- `va-form-21-0958-nod_2020.pdf`
- `va-form-21-22a_2020.pdf`
- `va-form-21-4142_2020.pdf`
- `va-form-21-4192-request-for-employment-info_2020.pdf`
- `va-form-21-8940-tdiu_app_2020.pdf`
- `va-form-3288.pdf`
- `va-form-95-tort-claim_2020.pdf`
- `va5655_2020.pdf`
- `va9_2020.pdf`
- `VA Form 10-10EZ.pdf`
- `VBA-20-0995-ARE.pdf`
- `VBA-21-0966-ARE.pdf`
- `VBA-21-526EZ-ARE.pdf`
- `VBA-21P-527EZ-ARE.pdf`
- `VBA-21P-534EZ-ARE.pdf`
- `VBA-21P-534a-ARE.pdf`
- `VBA-21P-535-ARE.pdf`
- `VBA-27-8832-ARE.pdf`
- `VBA-28-1900-ARE.pdf`

Remaining generic-fallback builder-native forms:

- None.

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

- Harden native curation: raw extraction now flows through a validated, data-driven curation stage. The 22-form sample corpus is curated and now has a save/re-open/generate round-trip guard; curation decisions are now visible in the import progress/report UI and covered by the builder smoke path for a looped 21P-527EZ import. Fully recipe-curated imports no longer open a large review wizard solely because source PDF field confidence was low. The next quality pass should continue selective repeated-group/list-loop opportunities only where the source rows are complete and regular.
- VA9 regression target: `/Users/clint/Downloads/va9_2020.pdf` now drives a curated structural regression test. Next quality pass should exercise it in the builder UI and then tighten recipe/generic extraction data from what the review panel reveals.
- Recipe layer: known form families (VA9, 21-0966, 27-8832, 28-1900, future forms) should improve generic imports without requiring every converted form to live in `examples/`. Keep recipes/corpus data-driven and reviewable.
- Continue hardening generic import quality with the curated corpus as regression data, especially where repeated XFA/static groups should become richer builder-native list loops.
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

1. **Continue selective list-loop promotion where row semantics are complete and regular** — 20-0995 issues/treatment facilities, 21P-527EZ dependent children/income/medical/care-provider rows, 21P-534EZ dependent children, and 21P-534a children are now looped. Best next is a targeted source-PDF validation pass for 21-526EZ disabilities before promoting that large table; rows 1-15 look clean, while rows 16-35 have shifted/extra date signals that should be understood first. Keep 21P-535 SSA service history and 21P-534EZ medical/care expenses/marital history deferred until source-PDF research validates row alignment.
2. **Use the automated builder smoke as the import UX contract guardrail** — keep `npm run builder:smoke` green whenever changing import status, review burden semantics, or curation-decision display.
3. **Use the quality ladder and target matrix as regression guardrails** — all 12 representative targets now meet their target levels. Keep them in the matrix so broad recipe or consolidation changes do not regress curated quality.
4. **Later: execute `form-route-to-va-gov.md`** — still useful, but corpus polish is the better next step now that PDF curation quality has reached full coverage.

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
