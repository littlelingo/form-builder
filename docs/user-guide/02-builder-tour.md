# 2. Builder tour

A guided walk through every part of the builder UI.

<!-- TODO: screenshot — full builder window with labelled regions (header, left panel, center canvas, right panel) -->

## Layout overview

The builder is a single page divided into four regions:

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER STRIP                                                │
├──────────────┬─────────────────────────────┬─────────────────┤
│              │                             │                 │
│  LEFT PANEL  │       CENTER CANVAS         │   RIGHT PANEL   │
│  (Toolbox)   │       (Workspace)           │   (Inspector)   │
│              │                             │                 │
└──────────────┴─────────────────────────────┴─────────────────┘
```

| Region | What it's for |
|--------|----------------|
| **Header strip** | File actions, undo/redo, switching workspace and preview modes. |
| **Left panel (Toolbox)** | Drag components in, navigate structure, load examples. |
| **Center (Canvas/Workspace)** | The form itself — edit, preview, run, or view code. |
| **Right panel (Inspector)** | Properties of whatever you have selected. |

## Header strip

| Button | What it does |
|--------|--------------|
| **New** | Start a fresh blank form. Asks to confirm if you have unsaved changes. |
| **Open JSON** | Load an authoring JSON file from disk. |
| **Save** | Download the current form as `{formId}-authoring.json`. The asterisk (`Save *`) appears when you have unsaved changes. |
| **Import PDF** | Start the [PDF import wizard](12-import-pdf.md). |
| **Undo / Redo** | Step backwards or forwards through your edit history (50 steps). |
| **More ▾** | Overflow menu: **Export JSON** (download without changing clean state), **Import custom templates**, **Export custom templates**, etc. |
| **Canvas mode** | Toggle between **Edit** (drag, drop, configure) and **Preview** (read-only form view). |
| **Workspace** | Switch the center between **Canvas**, **Run**, and **Code**. |
| **Preview system** | Switch between **USWDS** and **shadcn/ui** styling for previews. |

## Left panel — Toolbox

Three tabs:

### Build
The component palette. Components are grouped:

- **Fields** — Text input, Textarea, Character count, Masked input, Input group, Search.
- **Choice** — Radio buttons, Select, Combo box, Checkbox group, Yes/No, Switch, Range slider.
- **Date/time** — Date, Date range, Memorable date, Time picker.
- **Identity** — Email, Phone, Address, File upload.
- **Content** — Alert, Summary box, Text content, Accordion, Card, Table, Process list, Tag.
- **Actions** — Button, Button group.

Drag any component to the canvas. Components badged **Preview Only** are not yet generated into VA.gov output — see [Field reference](04-field-reference.md).

The **Build** tab also exposes:

- **Screen templates** — pre-assembled pages (blank, contact, identity, claimant/veteran, evidence, certification, yes/no with details).
- **Section templates** — pre-assembled chapters (standard, repeatable, employment loop, dependent loop).
- **Custom templates** — your own saved chapters or pages, importable/exportable as JSON.

### Outline
A hierarchical tree of the whole form: chapters → pages → fields. Click an item to select and edit it. Drag to reorder. Field counts show next to each page.

### Files
- Load one of the bundled examples (**21-4140 Employment Questionnaire**, **27-8832 Career Planning**) as a starting point.
- **Reload current form** — discard local edits, restore the last saved snapshot.

## Center — Workspace

Three views (switched from the header strip):

### Canvas
The visual editor. Two modes:

- **Edit mode** (default) — fields are draggable; you can add, remove, duplicate, reorder, and configure them. Drop zones appear between fields.
- **Preview mode** — read-only form view as the end user will see it. No drag/drop.

### Run
An interactive form simulator. Fill it out as a real user would. You'll see:

- Validation errors live.
- Computed values update as you change inputs.
- Conditional show/hide rules in action.
- The final submit payload at the end.
- A **Reset** button to start over.

### Code
Two read-only views:

- **Authoring JSON** — your saved source-of-truth.
- **Generated `formConfig`** — the compiled VA forms-system module. This is what an engineer integrates into `vets-website`.

A status badge shows **Valid** or **Invalid (n issues)**.

## Right panel — Inspector

The right panel changes based on what you have selected. It exposes up to five tabs:

### Setup
Form-level settings: title, plain-language heading, form ID, URLs, tracking prefix, prefill, computed values, and form-level event handlers. See [Form settings](10-form-settings.md), [Prefill](09-prefill.md), [Computed values](08-computed-values.md), [Handlers and actions](07-handlers-and-actions.md).

### Properties
Context-sensitive:

- A **field** is selected → field properties: label, hint, required, validations, options, conditions, layout, events. See [Field reference](04-field-reference.md).
- A **page** or **chapter** is selected → flow properties: title, body text, conditions, list-loop options. See [Form structure](03-form-structure.md).

### Audit
Compare your form against a saved baseline. Useful for catching unintended changes during a review cycle. See [Standards audit](14-standards-audit.md).

### Standards
Built-in checklist: VA accessibility, label length, required-field hints, USWDS component usage. See [Standards audit](14-standards-audit.md).

### Review (only after a PDF import)
The PDF import review wizard: confidence badges per imported field, accept/reject controls, and a **Promote recipe** button to save the structure for re-use on similar forms.

## Selecting things

- Click a field on the canvas to select it; the **Properties** tab updates.
- Click a page or chapter in the **Outline**; the **Properties** tab shows page or chapter settings.
- Click anywhere blank on the canvas to deselect.

## Undo / redo

Up to 50 steps. Buttons live in the header strip. Most actions are undoable — adding, deleting, reordering, editing properties, importing.

## What's next

- [Form structure](03-form-structure.md) — chapters, pages, fields explained.
- [Field reference](04-field-reference.md) — pick the right field for each question.

## Related

- [Save, export, publish](13-save-export-publish.md)
- [Preview and test](11-preview-and-test.md)
