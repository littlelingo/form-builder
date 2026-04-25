# VA Form Builder Resume Notes

Last updated: 2026-04-25 EDT after template helper preset controls

## Current Workspace

The standalone VA Form Builder lives at:

`/Users/clint/Workspace/va/form-builder`

Use this workspace first when resuming. The accepted direction is a standalone
low-code VA.gov form authoring tool that keeps authoring JSON as the source of
truth and generates VA `formConfig` as an output artifact.

## Current State

Resume from the template helper preset controls checkpoint. The latest passing
slice added an explicit Patterns-panel toggle for including generated helper
presets when built-in templates are inserted, and routes that choice through
click and drag insertion. The next recommended implementation slice is saved
template library polish, focused on rename/import metadata and clearer saved
template details.

Recent completed slices:

1. **Validation and computed-values authoring**
   - Field inspector now has stronger validation controls.
   - Required, `requiredIf`, min/max length, pattern, numeric min/max, and
     custom common constraint messages are editable.
   - Condition editing supports nested rules plus `in` and `notIn`.
   - Runner validation uses authored custom messages.

2. **Review and submit runner**
   - `Run` mode now includes a VA-style final review page.
   - Review shows standard section summaries and list-loop item summaries.
   - Mock submit reports ready/submitting/success/validation-blocked states.
   - Submit payload trims hidden answered fields.
   - Computed values and transformed data are shown in submit preview output.

3. **Generated-output support for promoted controls**
   - `characterCount` generates `textareaUI` / `textareaSchema` with
     `maxLength`.
   - `maskedInput` generates `textUI` / `textSchema` with pattern support.
   - `memorableDate` generates `currentOrPastDateUI` /
     `currentOrPastDateSchema`.
   - `dateRange` now generates a nested object with `startDate` and `endDate`,
     each using `currentOrPastDateUI` / `currentOrPastDateSchema`.
   - Preview and runner store `dateRange` values as
     `{ startDate, endDate }`.
   - Runner validation checks required date-range parts, invalid dates, and
     end-before-start.

4. **Starter template depth**
   - Pattern palette now includes:
     - Contact information
     - Identity
     - Claimant/Veteran split
     - Evidence upload
     - Certification/signature
     - Employment list-loop
     - Dependent list-loop
   - Employment and dependent templates create actual list-loop chapters.

5. **Promoted content-block hardening**
   - `prose`, `alert`, `summaryBox`, and `table` are saved schema component
     types and generate VA output.
   - Generated content blocks use `view:<id>` keys with `titleSchema`, so they
     display in VA pages without becoming submitted answer fields.
   - Content blocks now generate `ui:options.hideIf` for authored `showIf` and
     `hideIf` rules.
   - Runner review, validation, and mock-submit payload paths now exclude
     content-only components even if sample data contains stale values for
     those IDs.
   - `dateRange` inspector controls now expose start/end labels and hints.

6. **Table accessibility and date-range hardening**
   - Tables now support `headerRow`; new tables default to using the first row
     as column headers.
   - Builder preview and generated VA output render table header cells as
     `<th scope="col">` and remaining rows as body cells.
   - Table inspector exposes a "Use first row as table header" toggle.
   - `dateRange` generated VA output now includes end-after-start validation.
   - `dateRange` authoring supports `allowFutureDates`; when enabled, generated
     child date fields use plain VA date widgets instead of
     `currentOrPastDateUI`.
   - Runner validation enforces current-or-past date ranges by default and skips
     that future-date check when `allowFutureDates` is true.

7. **Starter template polish**
   - Contact, identity, claimant/Veteran, evidence, certification, yes/no
     details, employment list-loop, and dependent list-loop templates have
     tighter VA-style copy and safer default hints.
   - Evidence upload now defaults to PDF/JPG/PNG, 5 files, and 10 MB per file.
   - Yes/no details now requires the detail text only when the yes/no answer is
     true.
   - Employment list-loop now uses separate required start date and optional
     end date fields instead of a required date range, adds average monthly
     income with a non-negative constraint, and preserves current-job guidance.
   - Dependent template now adds date-of-birth and SSN helper text.

8. **Saved custom templates**
   - Patterns panel now has an inline template-name field and save action.
   - Authors can save the current screen or selected `sectionGroup` as a local
     reusable template.
   - Saved templates persist in browser `localStorage` and appear in a Saved
     templates group with add and delete controls.
   - Re-inserted saved templates remap component IDs and rule references so
     copied fields do not collide with existing IDs.

9. **Automated browser smoke tests**
   - `npm run builder:smoke` now starts the builder Vite app on a strict local
     port and drives Chromium through core authoring flows.
   - The smoke script covers adding a field, runner review/submit, valid Code
     tab output, saving a custom section template, reinserting it, checking
     generated component IDs remain unique, and deleting the saved template.
   - Browser console errors fail the smoke run, with the existing favicon 404
     ignored.

10. **Template-specific prefill and computed helpers**
    - Contact and identity starter templates now add normal authoring
      `prefill.mappings` and `computedValues` when inserted.
    - Contact templates map profile mailing address, email, and phone data to
      the generated contact field IDs and add `metadata.contactSummary`.
    - Identity templates map profile full name, date of birth, SSN, and VA file
      number data to generated identity field IDs and add
      `metadata.identitySummary`.
    - Helper insertion reuses the existing metadata/computed authoring model, so
      authors can edit or remove the generated helpers in the Setup panel.

11. **Saved template hardening**
    - Saved custom templates can now be exported as
      `va-form-builder-saved-templates.json`.
    - Authors can import saved-template JSON back into local saved templates;
      imported templates are normalized and receive fresh local IDs before being
      persisted.
    - Saved templates are now draggable from the Patterns panel, using the same
      canvas drop zones as fields and built-in section templates.
    - Browser smoke covers saved-template drag insertion, export, delete,
      import, and delete-after-import.

12. **Broadened browser smoke coverage**
    - `npm run builder:smoke` now uses a desktop viewport for the operational
      builder layout.
    - The smoke script checks Employment list insertion creates a real
      `listLoop` chapter with employer nouns and the monthly income field.
    - The smoke script checks new Table components expose the header-row toggle
      and render preview `<th scope="col">` cells.
    - The smoke script checks Date range exposes and persists the "Allow future
      dates" inspector toggle.
    - The smoke script loads the 27-8832 example, completes the Veteran/service
      member path through review, confirms claimant-only sections are skipped,
      and completes mock submit.

13. **Template helper preset controls**
    - Patterns now includes an accessible "Include helper presets" checkbox.
    - The setting defaults on, preserving existing Contact/Identity template
      behavior that adds prefill mappings and computed summary definitions.
    - Turning the setting off inserts the same template fields without adding
      generated prefill/computed helper definitions.
    - Click and drag insertion both carry the helper-preset choice into the
      template insertion helpers.
    - Browser smoke now verifies the default helper behavior and the declined
      helper path.

## Primary Files Changed Recently

- `src/schema/authoring-schema.json`
- `src/compiler/componentRegistry.mjs`
- `src/component-systems/componentSystems.mjs`
- `tests/compiler.test.mjs`
- `tests/runner.test.mjs`
- `apps/builder/src/App.tsx`
- `apps/builder/src/lib/formModel.ts`
- `apps/builder/src/lib/runnerFlow.js`
- `apps/builder/src/lib/runnerValidation.js`
- `apps/builder/src/components/BuildToolbox.tsx`
- `apps/builder/src/components/ConditionEditor.tsx`
- `apps/builder/src/components/InspectorPanel.tsx`
- `apps/builder/src/components/PreviewPanel.tsx`
- `apps/builder/src/components/RunnerPanel.tsx`
- `apps/builder/src/styles.css`
- `apps/builder/src/types.ts`
- `package.json`
- `package-lock.json`
- `tests/builder-smoke.mjs`

## Verified Commands

Run from `/Users/clint/Workspace/va/form-builder`:

```bash
npm test
npm run builder:build
npm run compile:example
npm run compile:example:27-8832
npm run builder:smoke
```

Latest verification after the template helper preset controls slice:

```bash
npm run builder:smoke
npm test
npm run builder:build
```

All three commands passed in `/Users/clint/Workspace/va/form-builder`. The
browser smoke command may need local-server permissions in sandboxed
environments and requires the Playwright Chromium browser to be installed with
`npx playwright install chromium`.

## Browser Smoke Notes

Manual browser smoke was done with Vite on `http://localhost:5174` because
`5173` was already in use.

Confirmed:

- Pattern palette shows the new reusable sections and advanced list-loop
  templates.
- `Date range` is available as a normal field, not preview-only.
- Runner renders Date range with Start date and End date inputs.
- Filling `2024-01-01` and `2024-12-31` stores:
  `{ "newDateRange": { "startDate": "2024-01-01", "endDate": "2024-12-31" } }`
- Code tab reports valid generated VA output for date range using
  `currentOrPastDateUI` / `currentOrPastDateSchema`.

Latest browser smoke was done with Vite on `http://localhost:5173`.

Confirmed:

- App loads with only the existing favicon 404 in the browser console.
- Adding a Table creates a semantic table with column headers in the preview.
- Table inspector shows the checked "Use first row as table header" control.
- Adding a Date range exposes the new "Allow future dates" toggle after
  opening the Date and time inspector section.
- Pattern palette opens and still lists reusable and advanced templates.
- Adding the Employment list template creates 1 section and 7 fields.
- Employment list now shows separate Date employment started, Date employment
  ended, Average monthly income, Employer address, and Reason employment ended
  fields with the revised hints.
- Saving a selected Contact information section creates a Saved templates entry.
- Clicking the saved template inserts a second copy with fresh field IDs.
- Deleting the saved template removes it from the Saved templates group.
- Automated smoke now covers add-field, runner review/submit, Code tab
  generation, saved-template save/add/delete, and unique generated component
  IDs.
- Automated smoke now also verifies contact and identity templates add expected
  prefill mappings and computed summary definitions to authoring JSON.
- Automated smoke now verifies saved-template drag insertion, export, import,
  and post-import delete behavior.
- Automated smoke now verifies Employment list authoring structure, Table
  header-row preview semantics, Date range future-date settings, and the
  27-8832 Veteran runner path through mock submit.
- Automated smoke now verifies the Patterns-panel helper preset control is on
  by default and that turning it off prevents additional Contact template
  prefill/computed helpers from being inserted.

Known browser-console issue:

- Existing favicon 404 only. No new functional browser errors were found.

## Best Next Steps

Recommended next sequence:

1. **Saved template library polish**
   - Consider renaming saved templates after import and showing imported
   metadata such as kind, field count, and created date.

2. **Additional runner smoke depth**
   - Add a smaller follow-up browser check for the 27-8832 dependent claimant
     path and the Dependent list template if runner coverage needs another
     layer.

3. **Template helper review details**
   - If authors need more visibility, show the exact helper mappings that will
     be inserted before applying a built-in template.

## Suggested First Files To Read Next Session

Start here:

- `README.md`
- `src/schema/authoring-schema.json`
- `src/compiler/componentRegistry.mjs`
- `src/component-systems/componentSystems.mjs`
- `apps/builder/src/lib/formModel.ts`
- `apps/builder/src/components/InspectorPanel.tsx`
- `apps/builder/src/components/PreviewPanel.tsx`
- `apps/builder/src/components/RunnerPanel.tsx`
- `apps/builder/src/lib/runnerValidation.js`
- `tests/compiler.test.mjs`
- `tests/runner.test.mjs`

## Guardrails

- Authoring JSON is the source of truth.
- Generated VA `formConfig` code is output only.
- Keep schema, TypeScript types, component system support, compiler behavior,
  builder UI, runner behavior, and tests aligned.
- Do not silently promote preview-only controls without generated VA output and
  tests.
- Prefer existing helpers in `src/compiler/*` and `apps/builder/src/lib/*`.
- USWDS remains the primary preview/run target.
- Treat shadcn as a secondary canvas comparison target for now.
- Before handing off, run `npm test`, `npm run builder:build`,
  `npm run compile:example`, and `npm run compile:example:27-8832`.
