# 4. Field reference

Every field type the builder supports, what it's for, and how to configure it.

> **Status badges**
>
> - **Supported** — fully authored and generated into VA.gov `formConfig` output.
> - **Preview Only** — visible in the builder palette, useful for early design / mockups, **but not yet produced by the generator**. Don't ship a form that depends on a Preview Only field; if you do, the engineer's downstream build will be incomplete.

## Universal properties

These apply to every input-capturing field. The Properties tab shows them when a field is selected.

| Property | What it does |
|----------|--------------|
| **ID** | Unique identifier within the form. Auto-generated when you drop a field; you can rename it. The ID is the path used in form data, conditions, and computed values. |
| **Label** | The visible question text. |
| **Hint** | Helper text below the label. |
| **Required** | Boolean — must the user answer this? |
| **Required when…** | Conditional required: the field is only required when a [rule](05-conditions.md) is true. |
| **Show this field when…** | The field appears only when the rule is true. |
| **Hide this field when…** | The field is hidden when the rule is true (inverse of Show). |
| **Validations** | Custom validation rules with custom error messages. See [Validations](06-validations.md). |
| **Custom error messages** | Override the built-in messages for `required`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`. |
| **Width** | `full` / `half` / `third` for multi-column layouts. |
| **Start a new row** | Force the field onto a fresh row. |
| **Events** | Field-scoped event handlers (change/focus/blur). See [Handlers and actions](07-handlers-and-actions.md). |
| **Include in summary card** | If true, this field appears on summary/review pages. |

Display-only fields (Alert, Summary box, etc.) have a smaller subset — typically just **Label**, **Description**, and **Show when…**.

---

## Fields category

### Text input *(Supported)*
**Use when:** the answer is a short typed string — name, agency code, account number.

Extra properties:

- **Input type** — `text`, `email`, `tel`, `number`, `url`, `search`, `password`. Changes keyboard on mobile and HTML5 validation.
- **Placeholder** — text shown inside the empty input.
- **Autocomplete** — HTML autocomplete hint (e.g., `given-name`, `tel`, `street-address`).
- **Min length / Max length** — character bounds.
- **Pattern** — a regex the value must match (e.g., `^[A-Z]{2}\d{6}$`).

### Textarea *(Supported)*
**Use when:** the answer is more than a sentence — explanations, narrative.

Same properties as Text input, minus **Input type**. Renders as a multi-line box.

### Character count *(Supported)*
**Use when:** the answer is free text **and** a character cap is meaningful (e.g., "summary in 280 characters").

A textarea with a live remaining-character counter. **Max length** drives the counter.

### Masked input *(Supported)*
**Use when:** the answer is a formatted token — SSN, EIN, ZIP+4, formatted phone.

Extra:

- **Pattern** — the format pattern.
- **Allow reveal** — show/hide toggle on the value (default on for sensitive fields).

### Input group **(Preview Only)**
**Use when:** the input needs a prefix or suffix — currency `$`, percent `%`, units like `lbs`.

Extra:

- **Prefix** — text before the input (e.g., `$`).
- **Suffix** — text after the input (e.g., `%`).

### Search **(Preview Only)**
**Use when:** the field is for filtering or lookup, not data capture.

Same as Text input with `inputType: search`.

---

## Choice category

### Radio buttons *(Supported)*
**Use when:** one choice from a small fixed list (≤7 options).

Extra:

- **Options** — array of `{ value, label, description?, id? }`. Edit in the Properties tab; one row per option.

### Select (dropdown) *(Supported)*
**Use when:** one choice from a medium-to-long list (state, country).

Same options as Radio buttons but rendered as a dropdown.

### Combo box **(Preview Only)**
**Use when:** one choice from a long list and you want type-to-filter search.

### Checkbox group *(Supported)*
**Use when:** zero or more choices from a list (interests, services used).

Same options as Radio buttons but multiple selections allowed.

### Yes/No *(Supported)*
**Use when:** the answer is a boolean. Stored as `true`, `false`, or `null` (unanswered).

Renders as two radios (Yes / No). No **Options** to configure.

### Switch **(Preview Only)**
**Use when:** an on/off toggle is more natural than Yes/No (e.g., "Receive notifications").

### Range slider **(Preview Only)**
**Use when:** a numeric value in a range with no need for precise typing.

Extra: **Minimum**, **Maximum**, **Step** (default 1).

---

## Date/time category

### Date *(Supported)*
**Use when:** any single date.

Extra:

- **Minimum / Maximum** — earliest / latest allowed (ISO date string).
- **Allow future dates** — defaults off (so VA forms typically allow only past/today).
- **Date format** — `month-day-year`, `month-year`, `year`, etc.

### Date range *(Supported)*
**Use when:** the answer is a start-and-end pair (employment dates, deployment dates).

Extra: **Start label**, **End label**, **Start hint**, **End hint**, plus all Date properties applied to both ends. Validates start ≤ end.

### Memorable date *(Supported)*
**Use when:** the user might not recall the exact day. Renders three separate inputs for month, day, year — easier than a date picker.

Same properties as Date.

### Time picker **(Preview Only)**
**Use when:** the answer is a time (HH:MM, optionally seconds).

---

## Identity category

### Email *(Supported)*
**Use when:** an email address. HTML5 email validation built in.

Same as Text input with `inputType: email`.

### Phone *(Supported)*
**Use when:** a phone number. HTML5 `tel` keyboard on mobile.

Same as Text input with formatted display. Pair with **Pattern** for strict validation.

### Address *(Supported)*
**Use when:** a structured mailing address. Composite field — multiple inputs grouped.

Sub-fields: street, street 2, city, state/territory, ZIP code, optional country.

Extra:

- **Military address** — adds APO/FPO option for service members.
- **Omit** — list of sub-fields to remove (e.g., `["stateOrTerritory"]` for international-only).

### File upload *(Supported)*
**Use when:** the user must attach a document (DD-214, medical records, evidence).

Extra:

- **Multiple** — allow more than one file.
- **Accepted types** — list of MIME types or extensions, e.g., `[".pdf", "image/*"]`.
- **Max file size** / **Min file size** — bytes per file.
- **Max file count** — number of files.
- **Endpoint** / **File upload URL** — backend upload target.
- **Disallow encrypted PDFs** — reject password-protected PDFs.
- **Skip upload** — defer the upload to form submit (rather than upload-as-you-go).

The runtime shows a progress bar per file and surfaces virus-scan results.

---

## Content category (display-only)

These render content but capture no user input. No Required, no Validations.

### Alert *(Supported)*
A coloured callout. Properties: **Label** (heading), **Description** (body), **Alert type** (`info`, `warning`, `error`, `success`).

### Summary box *(Supported)*
Highlighted explanatory content — typically used for "what you'll need" lists at the top of a chapter.

### Text content (prose) *(Supported)*
Free-form body text. Supports markdown / HTML in the **Description** field.

### Accordion **(Preview Only)**
Expandable panel for progressive disclosure. Properties: **Label** (header), **Description** (body), **Default open**.

### Card **(Preview Only)**
A grouped content block with a heading and body.

### Table *(Supported)*
Simple read-only data table. Properties: **Label** (caption), **Rows** (2D array of cells), **Header row** (use the first row as `<th>`).

### Process list **(Preview Only)**
A numbered ordered list — useful for step-by-step instructions before a complex chapter.

### Tag **(Preview Only)**
A small inline status label (e.g., "Required", "New").

---

## Actions category **(Preview Only)**

### Button **(Preview Only)**
Standalone button. Properties: **Label**, **Style** (`primary`, `secondary`, `outline`), **Action URL**.

### Button group **(Preview Only)**
Two buttons: primary and secondary. Properties: **Primary label**, **Secondary label**.

> The standard **Continue** / **Back** buttons on each page are produced automatically by the runtime — you don't add them with this component. The Action category is for inline calls-to-action (e.g., a "Download form" link in the middle of a page).

---

## Structural

### Section group *(Supported)*
A container that groups child components inside a fieldset. Properties: **Label** (group heading, optional), **Description**, **Show when…**. Drop other components into it. The compiler flattens or preserves the group as appropriate for accessibility (proper `<fieldset>` + `<legend>`).

---

## Picking the right field — quick guide

| The answer is... | Use |
|------------------|-----|
| A short typed string | **Text input** |
| Long free text | **Textarea** |
| A formatted token (SSN, EIN) | **Masked input** |
| One of a small set | **Radio buttons** |
| One of a long set | **Select** |
| One or more from a set | **Checkbox group** |
| Yes or no | **Yes/No** |
| A specific date | **Date** or **Memorable date** |
| A date range | **Date range** |
| An email | **Email** |
| A phone number | **Phone** |
| A mailing address | **Address** |
| A file | **File upload** |
| Display only — context, instructions | **Text content**, **Alert**, **Summary box** |

## Related

- [Conditions](05-conditions.md) — show/hide and required-when rules.
- [Validations](06-validations.md) — per-field validation.
- [Form structure](03-form-structure.md) — how fields fit into pages and chapters.
- [Glossary](glossary.md)
