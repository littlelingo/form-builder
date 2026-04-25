# End-User Guide Plan — VA Form Builder

## Context

VA Form Builder lacks end-user-facing documentation. Existing docs (`README.md`, `pdf-import-and-standards.md`, `import-llm-providers.md`, `form-route-to-va-gov.md`) target engineers and authors of the builder, not the non-engineer form authors who will use the tool day-to-day.

**Goal:** Produce a comprehensive, task-oriented user guide that lets a non-engineer (form author, designer, content strategist) sit down at the builder and ship a form without needing to read source code. Cover the full surface: flow, fields, properties, handlers/actions, conditions, computed values, prefill, import, preview, and export.

**Outcome:** Markdown user guide under `docs/user-guide/` with a clear top-level index and per-topic pages. Linkable from `README.md`. Screenshots deferred to follow-up unless user requests them now.

## Deliverables

All files written under `/Users/clint/Workspace/va/form-builder/docs/user-guide/`:

```
docs/user-guide/
├── README.md                       # Index + reading order + quick-start
├── 01-getting-started.md           # First form in 10 minutes
├── 02-builder-tour.md              # UI layout, panels, navigation
├── 03-form-structure.md            # Chapters → pages → fields hierarchy
├── 04-field-reference.md           # Every field type, properties, examples
├── 05-conditions.md                # Show/hide, required-if, rule builder
├── 06-validations.md               # Per-field validation rules + messages
├── 07-handlers-and-actions.md      # Events, actions, automation
├── 08-computed-values.md           # Derived/calculated values
├── 09-prefill.md                   # Backend/profile prefill mappings
├── 10-form-settings.md             # Metadata, URLs, tracking, design system
├── 11-preview-and-test.md          # Edit/Preview/Run modes, sample data
├── 12-import-pdf.md                # PDF → authoring JSON workflow
├── 13-save-export-publish.md       # Save, export JSON, generated code
├── 14-standards-audit.md           # Standards & accessibility audit
├── 15-templates.md                 # Custom templates, examples (21-4140, 27-8832)
└── glossary.md                     # Plain-language definitions of every term
```

## Per-Page Outline

### `README.md` (index)
- One-paragraph "What is this?"
- Audience: non-engineer form authors at VA
- Reading order: numbered list with one-line summaries
- Quick-start link → `01-getting-started.md`
- Glossary link

### `01-getting-started.md`
- What you need: browser, no install for using a hosted instance / `npm run builder:dev` for local
- Build first form: load blank → add a chapter → add a page → drop a text input → preview → save
- Walkthrough screenshots (deferred — placeholder TODOs)
- Where forms are stored (browser localStorage + downloaded JSON)
- Auto-restore behavior

### `02-builder-tour.md`
- Three-panel layout: left toolbox / center canvas / right inspector
- Header strip: New, Open JSON, Save, Import PDF, Undo/Redo, canvas mode (Edit/Preview), workspace selector (Canvas/Run/Code), preview system selector (USWDS / shadcn)
- Left toolbox tabs: **Build** (palette + templates), **Outline** (structure tree), **Files** (examples)
- Center workspace: **Preview** (visual canvas), **Run** (interactive simulator), **Code** (JSON + generated code)
- Right inspector tabs: **Setup** (form metadata), **Properties** (field/page editor), **Audit**, **Standards**, **Review** (PDF import only)
- Undo/redo (50 steps)
- Source: `apps/builder/src/App.tsx` lines 754-1051, `HeaderStrip.tsx`

### `03-form-structure.md`
- Hierarchy: **Chapters** (sections) → **Pages** (screens) → **Components** (fields)
- Chapter types: **standard** vs **listLoop** (repeating, e.g., employment history)
- ListLoop options: noun singular/plural, array path, max items
- Page properties: title, body text, conditions
- Drag-to-reorder via Outline panel
- Source: `FlowEditorPanel.tsx`, `StructurePanel.tsx`

### `04-field-reference.md`
Comprehensive catalog. One section per field with: purpose, when to use, all properties, validation options, example, status (Supported / Preview Only).

Categories and fields:
- **Text input**: Text input, Textarea, Character count, Masked input, Input group, Search
- **Choice**: Radio buttons, Select, Combo box, Checkbox group, Yes/No, Switch, Range slider
- **Date/Time**: Date, Date range, Memorable date, Time picker
- **Identity**: Email, Phone, Address, File upload
- **Content (display-only)**: Alert, Summary box, Text content, Accordion, Card, Table, Process list, Tag
- **Actions**: Button, Button group
- **Structural**: Section group

Universal properties table: id, type, label, hint, required, requiredIf, showIf, hideIf, validations, errorMessages, dataPath, layoutWidth, layoutNewRow, events, summaryCard.

Source: `apps/builder/src/lib/formModel.ts` lines 50-258, `src/component-systems/componentSystems.mjs`, `InspectorPanel.tsx`

### `05-conditions.md`
- Where conditions apply: chapter visibility, page visibility, field showIf/hideIf, requiredIf, handler conditions, computed-value conditions, validation conditions
- Three modes: **Single rule**, **All of these (AND)**, **Any of these (OR)**, plus **Not** wrapping
- Operators: equals, notEquals, in, notIn, exists, notExists, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual
- Nesting examples
- Worked examples: "Show field B only if field A = yes"; "Require contact info if applicant is dependent"
- Source: `ConditionEditor.tsx`

### `06-validations.md`
- Adding validations on a field: rule + custom error message
- Built-in validations per field type (minLength, maxLength, pattern, minimum, maximum, file size/type/count, date range, email format, phone format)
- Custom error message overrides per validation
- Conditional validations (only apply when rule true)
- Source: `FieldValidationsEditor.tsx`

### `07-handlers-and-actions.md`
- Events: `field.change`, `field.focus`, `field.blur`, `page.enter`, `form.beforeSubmit`, `form.submit`
- Actions: `setValue`, `setComponentProperty`, `setVisibility`, `setRequired`, `setValidationMessage`, `emitEvent`
- Value sources: `event.value`, `values.[fieldId]`, `components.[id].[property]`, literal
- Conditional actions
- Walked example: "When applicant type = Dependent, show dependent contact section and mark it required"
- Source: `EventHandlersEditor.tsx` lines 10-26

### `08-computed-values.md`
- Purpose: derive values from other fields; runs in preview, runner, submit transform
- Operations: literal, concat, sum, subtract, multiply, divide, coalesce, mapValue, booleanAny, booleanAll
- Configure: id, operation, sources, target path, optional condition
- Worked example: contact summary `email + " | " + phone`
- Source: `ComputedValuesEditor.tsx`

### `09-prefill.md`
- What prefill is and why
- Enable toggle in Setup tab
- Mappings: source path (e.g., `profile.email`) → target field id
- Generated `prefillEnabled` and prefill transform
- Example from 21-4140
- Source: `MetadataEditor.tsx` lines 127-180

### `10-form-settings.md`
- Identity: title, plain-language heading, formId, subtitle, version
- URLs: rootUrl, submitUrl, trackingPrefix
- Component system selection: USWDS (preview default), vaFormsSystem (generation target for VA.gov), shadcn (optional comparison)
- When to change each
- Source: `MetadataEditor.tsx`

### `11-preview-and-test.md`
- Three modes: **Edit canvas** (default), **Preview canvas** (read-only), **Run panel** (interactive simulator)
- Sample-answer picker in Run mode
- Validation error display
- Computed values preview
- Submit payload viewer
- Reset and re-fill
- USWDS vs shadcn preview toggle
- Source: `PreviewPanel.tsx`, `RunnerPanel.tsx`

### `12-import-pdf.md`
- When to use (existing AcroForm PDFs)
- Click "Import PDF" → select file → progress bar
- Pipeline stages user sees: Fingerprint → Extract AcroForm → Extract Text → Label Pairing → Field Consolidation → Corpus Matching → Enrichment → Build JSON → Validate → Load Canvas
- **Review panel**: confidence badges (high/medium/low), Accept/Reject per field, Accept All, Promote Recipe
- LLM enrichment (engineer-managed, document the env vars only as a sidebar)
- CLI alternative for batch (briefly link to `pdf-import-and-standards.md`)
- Source: `ImportWizard.tsx`, `ImportReviewPanel.tsx`, `src/import/pipeline.mjs`

### `13-save-export-publish.md`
- Auto-save to browser localStorage (key: `va-form-builder.lastForm.v1`)
- Manual Save: downloads `{formId}-authoring.json`, marks form clean
- Open JSON: re-load a saved file
- Export JSON: download without updating clean state
- Code panel: copy generated formConfig module
- Note: no server backend — forms live in browser + downloaded files
- Source: `App.tsx` lines 95-133, `HeaderStrip.tsx`

### `14-standards-audit.md`
- Standards tab: checklist-style validation against VA accessibility/USWDS standards
- Audit tab: baseline comparison and diffs
- How to set baseline, interpret warnings vs errors
- Source: `StandardsAuditPanel.tsx`, `AuditPanel.tsx`

### `15-templates.md`
- Custom templates: save current screen/section, reuse, export/import via JSON
- Stored in browser localStorage
- Two example forms shipped: 21-4140 (Employment Questionnaire), 27-8832 (Career Planning) — what each demonstrates
- How to load an example as a starting point
- Source: `App.tsx` lines 181-216, `FormActions.tsx`, `examples/`

### `glossary.md`
Plain-language definitions:
- Authoring JSON, Generated code, formConfig, USWDS, vaFormsSystem, shadcn, Chapter, Page, Component/Field, listLoop, Rule, Operator, Handler, Action, Event, Computed value, Prefill, Provenance, Confidence, Recipe, Corpus, AcroForm, Baseline, Standards audit

## Critical Source Files (already mapped from research)

| Topic | File |
|-------|------|
| App shell | `apps/builder/src/App.tsx` |
| Header toolbar | `apps/builder/src/components/HeaderStrip.tsx` |
| Field properties | `apps/builder/src/components/InspectorPanel.tsx` |
| Section/page properties | `apps/builder/src/components/FlowEditorPanel.tsx` |
| Form metadata | `apps/builder/src/components/MetadataEditor.tsx` |
| Conditions | `apps/builder/src/components/ConditionEditor.tsx` |
| Validations | `apps/builder/src/components/FieldValidationsEditor.tsx` |
| Event handlers | `apps/builder/src/components/EventHandlersEditor.tsx` |
| Computed values | `apps/builder/src/components/ComputedValuesEditor.tsx` |
| Field model | `apps/builder/src/lib/formModel.ts` |
| Authoring schema | `src/schema/authoring-schema.json` |
| Component systems | `src/component-systems/componentSystems.mjs` |
| Import pipeline | `src/import/pipeline.mjs` |
| Import review UI | `apps/builder/src/components/ImportReviewPanel.tsx`, `ImportWizard.tsx` |
| Standards audit UI | `apps/builder/src/components/StandardsAuditPanel.tsx` |
| Examples | `examples/21-4140-authoring.json`, `examples/27-8832-authoring.json` |
| Existing engineer-facing docs (cross-link, do not duplicate) | `pdf-import-and-standards.md`, `import-llm-providers.md`, `form-route-to-va-gov.md` |

## Style & Voice

- Audience: non-engineer. No code blocks except where users see/copy values. No JSX/TypeScript snippets.
- Task-oriented headings ("Make a field appear only when…").
- Worked examples for every conceptual topic.
- Terminology consistent with the UI (e.g., "Section" not "Chapter" when the UI says "Section"; flag both terms once in glossary).
- Cross-link liberally. Each page has a "Related" footer.
- Screenshots: leave `<!-- TODO: screenshot -->` placeholders; do not block on them.

## Verification

- Walk a non-engineer (or simulate one) through `01-getting-started.md` end-to-end without referring to source code; confirm builder state matches each step.
- Cross-check field reference (`04-field-reference.md`) against `formModel.ts` and `componentSystems.mjs`: every entry in code is documented; every documented entry exists in code with matching status.
- Cross-check handlers/actions list against `EventHandlersEditor.tsx`.
- Cross-check rule operators against `ConditionEditor.tsx`.
- Cross-check computed-value operations against `ComputedValuesEditor.tsx`.
- Add a link from root `README.md` to `docs/user-guide/README.md`.
- Run `npm run builder:dev` and verify each panel/feature mentioned actually exists in current UI before describing it (catch documentation drift).

## Decisions (from user)

1. **Audience**: VA + partner contributors. Define every VA-specific term in `glossary.md`. Avoid unexplained jargon. First mention of any VA-specific term gets a parenthetical or glossary link.
2. **Screenshots**: Text first. Insert `<!-- TODO: screenshot — <description> -->` placeholders at every spot a screenshot would help. No blocking on capture.
3. **Builder access**: Local only via `npm run builder:dev`. `01-getting-started.md` covers: clone, `npm install`, `npm run builder:dev`, open `http://localhost:5173`. Skip hosted-instance language.
4. **Preview Only fields**: Documented in `04-field-reference.md` with a clear `**Preview Only**` badge and warning ("not yet generated into VA.gov forms — do not ship a form that depends on this"). Authors get full discoverability without footguns.
5. **Generated-code handoff**: Include a short "Handing off to engineers" subsection in `13-save-export-publish.md` covering: where the generated code goes, what `formId` / `rootUrl` / `submitUrl` mean to the receiving team, and which file to deliver (the authoring JSON, not the generated code — engineers regenerate).
