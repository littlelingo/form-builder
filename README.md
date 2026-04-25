# VA Form Builder

Standalone foundation for a low-code VA.gov form builder.

This package intentionally lives outside `vets-website-main`. It does not modify VA source. It provides:

- A versioned authoring schema contract.
- A deterministic compiler from authoring JSON to generated VA `formConfig` module code.
- A declarative rule engine for preview and generated code.
- Declarative dynamic validations and computed values.
- A component-system catalog with USWDS as the primary target and shadcn/ui as an optional preview/builder target.
- Compatibility/audit diff utilities for schema versioning.
- Representative authoring examples, including 21-4140 with list-loop, prefill, and file upload, and 27-8832 with Chapter 36 claimant conditions and certification flow.

## Commands

```bash
npm install
npm test
npm run compile:example
npm run compile:example:27-8832
npm run builder:dev
npm run builder:build
```

The compiler and audit utilities have no runtime third-party dependencies. The builder UI is a React/Vite workspace app and uses USWDS CSS for the primary preview.

## Builder App

The first UI shell lives in `apps/builder`.

Implemented builder features:

- Form metadata editing.
- Prefill mapping editing.
- JSON import/export.
- Example loading from the Files panel for 21-4140 and 27-8832 authoring JSON.
- Draggable component toolbox.
- Draggable section and screen templates for common form structure.
- Canvas drop zones for adding and reordering fields.
- In-canvas field remove and duplicate actions.
- Side-drop layout behavior for placing fields in two-column rows.
- Layout controls for full-row, two-column, three-column, and explicit row starts.
- Common builder toolbar for undo/redo, adding chapters/pages, and switching workspace views.
- Explicit canvas edit/preview modes, with drag/drop and field actions locked in preview mode.
- Chapter/page/field navigation.
- Chapter and page creation/removal.
- Chapter and page editing.
- Chapter, page, and field ordering controls.
- USWDS-first component palette.
- Field label, ID, hint, required, option, and file-upload endpoint editing.
- Visual condition editing for chapter, page, field visibility, and dynamic required behavior, including nested all/any branching.
- List-loop chapter settings for nouns, array path, max items, required behavior, item label, and intro text.
- USWDS and shadcn-style preview target switch.
- Live sample-answer preview data that drives conditional visibility and dynamic required behavior.
- Computed-value preview output alongside raw sample answers.
- Live authoring JSON and generated VA `formConfig` output.
- Audit panel showing validation and compatibility changes from the loaded baseline.

## Current Scope

Implemented component mappings:

- `textInput`
- `textArea`
- `date`
- `radioButton`
- `select`
- `checkbox`
- `fileUpload`
- `address`
- `phone`
- `email`
- `yesNo`

Implemented flow support:

- Standard chapters/pages.
- List-loop chapters generated through VA `arrayBuilderPages`.
- Declarative page and field conditions.
- Dynamic required rules.
- Declarative validation rules.
- Computed values applied during generated submit transforms.
- Prefill metadata, generated `prefillEnabled` flag, and declarative prefill mappings.
- Customizable `submitUrl`.

## Component Systems

The authoring schema uses semantic component types, not implementation-specific JSX. Targets are mapped in `src/component-systems/componentSystems.mjs`.

- `uswds`: Primary preview and builder target using USWDS form controls such as text input, textarea, radio buttons, select, checkbox, and file input.
- `vaFormsSystem`: Generated VA.gov code target using VA forms-system web-component patterns such as `textUI`, `selectUI`, `fileInputUI`, and `arrayBuilderPages`.
- `shadcn`: Optional preview/builder target using shadcn/ui registry components such as `Field`, `Input`, `Textarea`, `Checkbox`, `RadioGroup`, and `Select`.

## Design Principle

The saved source of truth is authoring JSON. Generated VA code is an output artifact.

Do not store raw VA `formConfig` as the authoring source because it requires executable JavaScript and React components.
