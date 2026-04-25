# 3. Form structure

Every form has the same three-level shape.

```
Form
├── Chapter (also called "Section")
│   ├── Page (also called "Screen")
│   │   ├── Field (component)
│   │   ├── Field
│   │   └── ...
│   └── Page
│       └── ...
└── Chapter
    └── ...
```

In the UI you'll see **Section** and **Screen** in some places and **Chapter** and **Page** in others — they refer to the same things. The compiled output uses **Chapter** and **Page**. We'll use *chapter* and *page* in this guide.

<!-- TODO: screenshot — Outline panel showing a multi-chapter, multi-page tree -->

## Chapters (sections)

A **chapter** is a top-level grouping of related pages — typically what you'd put on a single tab or step heading in a multi-step form. The progress indicator on a real VA form shows one tick per chapter.

### Chapter properties (Properties tab)

| Property | What it does |
|----------|--------------|
| **Title** | Chapter heading shown to the user. |
| **Type** | `standard` (single occurrence) or `listLoop` (repeating — see below). |
| **Show this chapter when** | Optional [condition](05-conditions.md) controlling whether the whole chapter appears. |

### Two chapter types

- **Standard** — appears once.
- **List loop (`listLoop`)** — repeats once per item in a list. Use for "tell us about each job", "tell us about each dependent", etc.

### List-loop options

When **Type** is **List loop**, additional options appear:

| Option | What it controls |
|--------|------------------|
| **Item name (singular / plural)** | E.g., *Employer / Employers*, *Dependent / Dependents*. Drives wording in the loop UI. |
| **Array path** | Where the list is stored in the form data, e.g., `data.employers`. |
| **Required** | If true, the user must add at least one item. |
| **Max items** | Optional cap on how many entries are allowed. |
| **Item name label** | Field used for the list summary label (e.g., the employer's name). |
| **Section intro** | Intro text shown before the list. |

A list-loop chapter typically contains the pages a user sees **per item** (e.g., one page asking for employer name, one for dates, one for income). The runtime repeats those pages for each list item.

The bundled **21-4140** example demonstrates a list-loop chapter for employment history.

## Pages (screens)

A **page** is a single "screen" the user fills in before clicking **Continue**. Most pages are short — one focused topic.

### Page properties

| Property | What it does |
|----------|--------------|
| **Title** | Heading shown to the user at the top of the screen. |
| **Body text** | Optional intro / instructions under the title. |
| **Show this page when** | Optional [condition](05-conditions.md) controlling visibility. |

### How many fields per page?

Best practice on VA.gov is **one topic per page** — usually 1–6 fields. Long pages hurt accessibility and screen-reader usability. The Standards audit (see [Standards audit](14-standards-audit.md)) flags overlong pages.

## Fields (components)

A **field** is anything inside a page — an input, a piece of explanatory text, a button. The full catalogue is in the [Field reference](04-field-reference.md).

### Section group (container field)

A special structural field. Drop it on a page to group child components into a labelled fieldset. Useful when several questions share a heading (e.g., a "Mailing address" group with custom layout). Section groups can nest.

## Adding, reordering, removing

| Action | How |
|--------|------|
| **Add a chapter** | Outline panel → action menu on the form root, or use a chapter template from the Build palette. |
| **Add a page** | Outline panel → action menu on a chapter. |
| **Add a field** | Drag from the Build palette onto the canvas, or use a screen template. |
| **Reorder** | Drag in the Outline panel, or drag fields on the canvas. |
| **Duplicate** | Inline action on each canvas field. Pages duplicate from the Outline. |
| **Delete** | Inline action, or `Delete` keyboard shortcut while selected. Undo restores it. |
| **Move between pages or chapters** | Drag in the Outline panel. |

## Layout within a page

Fields default to full-width, stacked. Each input field has these layout properties:

| Property | What it does |
|----------|--------------|
| **Width** | `full` (default), `half`, or `third` — for multi-column layouts on wide screens. |
| **Start a new row** | Force this field onto a fresh row even if the previous row had space. |

Use sparingly — multi-column layouts are harder to scan and harder for assistive tech.

## Common patterns

### Branching by applicant type
Top page asks "Are you the veteran or a dependent?" → use [conditions](05-conditions.md) on later chapters/pages so each applicant only sees what's relevant. The **27-8832** example demonstrates this pattern.

### Repeating sections (list loops)
Use a `listLoop` chapter when the user tells you about an unknown number of similar things (jobs, dependents, addresses, claims). The runtime handles add/edit/remove UX automatically.

### Conditional follow-up
"Do you have a phone? If yes, what is it?" — set the phone field's **Show this field when** condition to the yes/no answer. See [Conditions](05-conditions.md).

### Review / certification page
Final chapter typically has a single page with summary content, a certification statement (Yes/No or Checkbox), and lets the user submit. The **27-8832** example shows this.

## What's next

- [Field reference](04-field-reference.md) — pick the right field type.
- [Conditions](05-conditions.md) — control visibility and required-by-rule.

## Related

- [Templates and examples](15-templates.md)
- [Glossary](glossary.md)
