# Exporting a Form-Builder Form to VA.gov

## Context

The VA Form Builder at `/Users/clint/Workspace/va/form-builder` produces authoring JSON as its source of truth and compiles it to a single VA `formConfig` ES module. Today there is no real "export to VA.gov" path: the generated code is shown in a `<pre>` block in the builder, the CLI prints it to stdout, and there is no scaffold for the rest of the files a `vets-website` form application requires (`manifest.json`, `app-entry.jsx`, `routes.jsx`, `reducers/`, `pages/`, tests, sass, fixtures). No git/PR integration exists.

This plan describes the current export surface, the gap to a deployable VA.gov form app folder, and a recommended path that preserves the "authoring JSON is canonical" guardrail while making hand-off to engineers efficient.

## Current Export Surface — Snapshot

- **CLI** (`src/cli/compile.mjs`) — runs `compileAuthoringForm` then `generateVaFormConfigModule({ includeManifestImport: false })`, writes one ES module string to stdout. No file written, no folder structure.
- **Generator** (`src/generator/vaFormConfigGenerator.mjs`) — emits a single self-contained ES module: imports (React, VA web-component patterns, `arrayBuilderPages` if used), inline runtime helpers (`evaluateAuthoringRule`, `applyAuthoringComputedValues`, prefill mapper, event runtime), chapter/page tree, `formConfig` default export.
- **Builder UI** (`apps/builder/src/components/OutputPanel.tsx`, `FormActions.tsx`) — shows authoring JSON and generated code as text. Only download is `{formId}-authoring.json` (the source). No "download generated app" affordance, no PR action, no clipboard helper for generated code.
- **Audit** (`src/audit/diff.mjs`) — produces compatibility classification vs. baseline schema but is not yet wired into any publish/release gate.

**Net:** the generated module is roughly 1/5 of a deployable VA.gov form app, with no path to land the other 4/5 in `vets-website`.

## Two Viable VA.gov Runtime Paths

### Path A — Static generated app folder
Generate a full `src/applications/<form-id>/` directory in `vets-website-main` containing:

- `manifest.json` (`appName`, `entryName`, `entryFile: ./app-entry.jsx`, `rootUrl`, `productId`)
- `app-entry.jsx` (boots `RoutedSavableApp` with generated `formConfig`)
- `routes.jsx` (calls `createRoutesWithSaveInProgress`)
- `reducers/index.js` (form reducer factory from platform)
- `config/form.js` (the generated `formConfig` from this builder)
- `pages/*.js` (optional split-out per page if config gets large)
- `tests/unit/*.unit.spec.jsx` and `tests/e2e/*.cypress.spec.js` scaffolds + fixtures
- `sass/<form-id>.scss` placeholder

Apps auto-register via `config/manifest-helpers.js` `getAppManifests()` scan. No central registry edit needed.

### Path B — Thin app shell + JSON to `simple-forms-form-engine`
Generate only:

- `manifest.json`
- `app-entry.jsx` that calls `startFormEngineApp({ formId, rootUrl, ... })`
- A `digital-forms.json` (or per-form JSON) consumed by `FormRenderer.fetchAndBuildFormConfig` from Drupal/CMS or bundled assets

`simple-forms-form-engine` already supports runtime JSON via the `NormalizedForm` shape (`shared/types.js`, `shared/utils/digitalFormPatterns.js`). This requires the authoring schema to map cleanly into `NormalizedForm` (close, not identical — needs an adapter).

## Recommendation — Hybrid: Path A first, Path B later

Ship Path A as the MVP export because:

- It uses the compiler we already have (no new schema-mapping work).
- Generated code is reviewable in PR (engineering culture fit).
- It works for any pattern the compiler supports without waiting on Drupal/CMS plumbing.
- It exercises the same VA forms-system runtime VA.gov already runs.

Layer Path B in later as a "JSON-driven" mode for forms that fit the engine's normalized vocabulary, so authors can publish content-only changes without a PR.

## Recommended Export Pipeline (Path A)

### 1. Multi-file scaffold writer
New module `src/generator/appFolderGenerator.mjs` that, given a compiled form, returns a `Map<relativePath, fileContents>`. Files:

- `manifest.json` — derived from authoring metadata (`formId` → `entryName`, `title` → `appName`, `submitUrl`/`rootUrl` from authoring metadata; require a new `rootUrl` field on the authoring schema)
- `app-entry.jsx` — fixed template that imports `./routes` and registers the app
- `routes.jsx` — fixed template wrapping `createRoutesWithSaveInProgress(formConfig)`
- `reducers/index.js` — fixed `createSaveInProgressFormReducer` template
- `config/form.js` — output of existing `generateVaFormConfigModule` with `includeManifestImport: true`
- `tests/unit/config.unit.spec.jsx` — smoke test that imports `formConfig` and asserts chapters exist
- `tests/e2e/<form-id>.cypress.spec.js` — minimal happy-path Cypress scaffold
- `sass/<form-id>.scss` — empty placeholder
- `_authoring/<form-id>.authoring.json` — committed snapshot of source authoring JSON (round-trip + audit anchor)

Templates live in `src/generator/templates/` as plain `.tmpl` files with `{{placeholder}}` substitution — no template engine dependency.

### 2. CLI surface
Extend `src/cli/compile.mjs`:

```bash
node src/cli/compile.mjs examples/21-4140-authoring.json --out ./build/21-4140
```

When `--out` is set, write the scaffold; without it, keep current stdout behavior for back-compat. Add `--zip` to bundle the folder for browser-download.

### 3. Builder UI export action
In `apps/builder/src/components/FormActions.tsx`, add **Export VA.gov app** button next to existing Export JSON. Uses the same scaffold function (shared between CLI and UI via `src/generator/appFolderGenerator.mjs`), zips in-browser via `JSZip` (already a tiny dep, or use the streams API), triggers download as `<form-id>-vets-website-app.zip`.

In `OutputPanel.tsx`, add a per-file tabbed view of all scaffold files so authors/engineers can preview before download.

### 4. Audit gate before export
Wire `diffAuthoringForms` into the export flow:

- Show an Export Readiness panel surfacing `safe / compatible / migrationRequired / breaking` counts vs. the last published baseline (stored in the authoring JSON `lineage.previousVersion`).
- Block download when `breaking` changes exist without an explicit acknowledgement.
- Embed the change classification + authoring schema hash into the generated `_authoring/<form-id>.authoring.json` header for traceability.

### 5. PR hand-off (later, optional)
Two options, lowest-effort first:

- **Manual**: download zip, unzip into `vets-website/src/applications/`, commit, push, open PR. Document in a `RUN_ON_VA.md` template included in the zip.
- **Automated**: a small Node script `src/cli/openPr.mjs` that uses the GitHub REST API with a user-supplied PAT to create a branch, commit the scaffold, and open a PR against `vets-website`. Defer until the manual flow proves the artifact shape is correct.

## Recommendations to Make Export More Efficient & Effective

1. **Treat the scaffold as the canonical export artifact.** Don't pretend a single `formConfig.js` is enough — the deployable unit is the app folder. Generate it, ship it whole.
2. **Commit the authoring JSON next to generated code.** A `_authoring/<form-id>.authoring.json` in the app folder makes regeneration deterministic and gives PR reviewers the source-of-truth diff alongside the generated diff.
3. **Lock generated files with a header marker.** Top-of-file `// @generated from <form-id>.authoring.json schema v<X> hash <SHA>` so engineers know not to hand-edit. Optional codeowner rule blocks edits.
4. **Add a baseline-snapshot mechanism.** Builder needs to know "what did we last publish for this `formId`" to drive the audit gate. Persist a published baseline (start with browser `localStorage` like saved templates; later move to a backend per the research plan's Artifact 4).
5. **Generate fixtures alongside config.** Use the runner's `buildSubmitPayload` to emit a sample submission fixture per form. Cypress + unit specs both want it.
6. **Keep scaffold templates small and stable.** `app-entry.jsx`, `routes.jsx`, `reducers/index.js` are essentially boilerplate — keep them under 30 lines each so generated diffs stay legible.
7. **Make the export deterministic.** No timestamps, no random IDs, no map-iteration ordering in generated output. Sort imports, sort keys, stable pretty-print. Required for clean PR diffs across re-exports.
8. **Validate before write.** Refuse to emit the scaffold if `validateAuthoringForm` fails or the compiler reports unsupported component-system pairs. Surface the failure in the UI.
9. **Round-trip test in CI.** New test `tests/export.test.mjs` that exports both example forms, re-parses every generated file, asserts contents include expected imports + `formConfig` export. Catches generator regressions early.
10. **Defer PR automation.** Manual hand-off (zip + paste) is fine for MVP. Automating GitHub PRs adds auth/secret/permissions complexity that's not load-bearing on whether the export itself works.
11. **Eventually graduate to JSON-driven runtime (Path B).** Once authoring schema → `NormalizedForm` mapping is proven, content-only changes can ship as JSON updates without regenerating React code at all. Massive author-velocity win for forms that fit.

## Critical Files to Modify

- `src/cli/compile.mjs` — add `--out`, `--zip` flags
- `src/generator/vaFormConfigGenerator.mjs` — flip `includeManifestImport` default when scaffold mode is used
- `src/generator/appFolderGenerator.mjs` — **NEW**, multi-file scaffold writer
- `src/generator/templates/*.tmpl` — **NEW**, app-entry/routes/reducer/test templates
- `src/schema/authoring-schema.json` — add `rootUrl`, `productId`, optional `lineage.previousVersion`
- `src/audit/diff.mjs` — already produces classification; new wiring point only
- `apps/builder/src/components/FormActions.tsx` — Export VA.gov app button
- `apps/builder/src/components/OutputPanel.tsx` — per-file scaffold preview tabs
- `apps/builder/src/lib/core.ts` — re-export the new scaffold function
- `tests/export.test.mjs` — **NEW**, round-trip + smoke
- `tests/builder-smoke.mjs` — extend with download-export click

## Reused Existing Pieces

- `compileAuthoringForm` and `validateAuthoringForm` (`src/compiler/authoringCompiler.mjs`)
- `generateVaFormConfigModule` (`src/generator/vaFormConfigGenerator.mjs`)
- `diffAuthoringForms` (`src/audit/diff.mjs`)
- `buildSubmitPayload` (`apps/builder/src/lib/runnerFlow.js`) — for fixtures
- `getComponentSystemSupport` and `getUnsupportedComponentTypes` (`src/component-systems/componentSystems.mjs`) — pre-export validation gate
- `config/manifest-helpers.js` in `vets-website-main` — auto-discovery, no central registry edit needed

## Verification

- `npm test` — must pass; new `tests/export.test.mjs` exports both example forms, asserts presence of `manifest.json`, `app-entry.jsx`, `routes.jsx`, `reducers/index.js`, `config/form.js`, `_authoring/<form-id>.authoring.json` in the result map; asserts deterministic output across two runs (byte-identical).
- `node src/cli/compile.mjs examples/21-4140-authoring.json --out ./build/21-4140` — produces the full folder; manually copy into a local `vets-website` checkout under `src/applications/21-4140/`, run vets-website build, confirm route resolves and form renders.
- `npm run builder:build` — type-check passes after UI additions.
- `npm run builder:smoke` — extend Playwright script to click the new Export VA.gov app button and assert a zip download triggers.
- Manual: open the downloaded zip, unzip, run `eslint` on generated `.jsx`/`.js` files, expect zero errors.

## Out of Scope for This Plan

- Backend draft/version/audit storage (research plan's Artifact 4) — needed for Phase 4 publishing, not for getting export working.
- Automated PR creation against `vets-website` — defer to later.
- Path B (`simple-forms-form-engine` JSON runtime) — separate follow-on once Path A ships.
- Submitted/PDF display template generation — explicitly out of MVP per the research plan.
