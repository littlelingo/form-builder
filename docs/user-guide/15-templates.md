# 15. Templates and examples

Three kinds of pre-built starting points are available:

1. **Screen templates** — pre-assembled pages.
2. **Section templates** — pre-assembled chapters.
3. **Custom templates** — your own saved screens or sections.
4. **Example forms** — two complete reference forms shipped with the builder.

<!-- TODO: screenshot — Build palette with templates section expanded -->

## Screen templates (Build tab)

Drop a single page with sensible defaults. Available templates:

| Template | Contains | Use for |
|----------|----------|---------|
| **Blank** | Empty page. | When you want to start clean. |
| **Contact** | Email + phone. | Most forms have this somewhere. |
| **Identity** | Name, date of birth, SSN (or VA file number). | Personal-info pages. |
| **Claimant or veteran** | Branching on relationship to the veteran. | Family / dependent forms. |
| **Evidence** | File upload + description fields. | Pages where users attach proof. |
| **Certification** | Statement + Yes/No certification + signature. | Final review / sign-off pages. |
| **Yes/No with details** | Yes/No question with a conditional textarea revealed when answered yes. | Common conditional follow-up pattern. |

Drag any of these from the **Build** tab onto a chapter to insert it as a new page.

## Section templates (Build tab)

Drop a whole chapter (one or more pages with associated config).

| Template | Contains | Use for |
|----------|----------|---------|
| **Standard** | A single empty page in a single chapter. | Default starting chapter. |
| **Contact / Identity / Evidence / Certification / Yes-no with details** | Same as the screen templates, packaged as a chapter. | When the topic warrants its own chapter. |
| **Repeatable (list-loop)** | A `listLoop` chapter with a per-item page. | "Tell us about each X" patterns. |
| **Employment loop** | A purpose-built `listLoop` with employer name, dates, employer address, income. | Employment-history sections. |
| **Dependent loop** | A `listLoop` with name, relationship, dates. | Dependent-list sections. |

## Custom templates

You can save any screen or chapter from your form as a custom template, then re-use it across forms.

### Save a custom template

1. In the **Outline** panel, right-click (or use the actions menu on) the page or chapter you want to save.
2. Choose **Save as template**.
3. Give it a name and (optionally) a description.

The custom template now appears in the **Build** tab under **Custom templates** and is stored in your browser's local storage (`va-form-builder.customTemplates.v1`).

### Export / import templates

Custom templates live in your browser, so they don't transfer between machines automatically. To share:

- **Export:** header **More ▾** → **Export custom templates** → downloads a JSON file with all your saved templates.
- **Import:** header **More ▾** → **Import custom templates** → load a colleague's file.

Export and check templates into your team's Git repo for durable sharing.

### Helper presets

Two screen templates (**Contact** and **Identity**) optionally include **authoring helpers** — pre-baked prefill mappings and computed values associated with the fields they include. When inserted with helpers enabled, the relevant **Setup → Prefill** mappings and **Setup → Computed values** entries appear automatically. A toggle on insertion lets you opt out.

## Example forms

Two complete real-world forms ship in `examples/` and are loadable from the **Files** tab.

### 21-4140 — Employment Questionnaire

**Demonstrates:**

- Identity & contact pages
- Prefill mappings (`profile.email`, `profile.phone`, etc.)
- A `listLoop` chapter for employment history
- A computed value combining contact info into a summary
- Conditional file upload (only required when the user reports income)

Source: `examples/21-4140-authoring.json`. Compile via `npm run compile:example`.

### 27-8832 — Personalized Career Planning and Guidance

**Demonstrates:**

- Applicant-type branching (veteran vs. dependent) — multi-chapter conditional flow
- Checkbox groups and radio selections
- Address blocks (including military)
- Chapter 36 guidance selection
- A certification page

Source: `examples/27-8832-authoring.json`. Compile via `npm run compile:example:27-8832`.

## Loading an example

1. Open the **Files** tab in the left panel.
2. Click the example you want.
3. The current form is replaced. (If you have unsaved changes, the builder prompts to confirm.)

The example loads as if you'd authored it — full editing, no read-only constraints. Make a copy by saving with a different **Form ID**.

## Tips

- **Templates are starting points, not finished work.** Always read each field's label, hint, and validation; rename IDs to match your form's naming.
- **Save patterns you find yourself rebuilding.** If you've authored the same kind of "yes with explanation" three times, save it as a custom template.
- **Use the examples as a reference for advanced features.** Conditional branching, list loops, computed values, and prefill all appear in 21-4140 and 27-8832 — the most efficient way to learn the builder's idioms is to load one and inspect it.

## Related

- [Form structure](03-form-structure.md)
- [Prefill](09-prefill.md)
- [Computed values](08-computed-values.md)
