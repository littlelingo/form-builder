# Glossary

Plain-language definitions of every term that appears in the user guide.

## Builder concepts

**Authoring JSON** — The saved source of truth for a form. A `*-authoring.json` file describing chapters, pages, fields, conditions, and settings. The builder reads and writes this. Engineers compile it into runnable code.

**Chapter** — Top-level grouping of pages. Also called a **section** in some UI labels. A multi-step VA form typically has one tick on the progress indicator per chapter.

**Page** — A single screen in a form, between two **Continue** clicks. Also called a **screen**. Contains one or more fields.

**Component / Field** — Anything inside a page: an input, a piece of text, an alert. The builder palette calls them "components"; this guide also uses "field" when the component captures user input.

**List loop (`listLoop`)** — A chapter type that repeats once per item in a list. Used for "tell us about each X" patterns (employers, dependents, addresses).

**Section group** — A structural component that groups child fields under a fieldset/heading. Different from chapter/section.

**Authoring helpers** — Pre-baked prefill mappings and computed values bundled with certain templates (Contact, Identity). Inserted alongside the template when enabled.

**Confidence** — A high/medium/low score attached to fields produced by PDF import. Indicates how certain the importer is about the field's label and type. See [PDF import](12-import-pdf.md).

**Provenance** — Metadata stored on imported components recording their origin (which PDF, which page, which AcroForm field, what confidence). Useful for auditing.

**Recipe** — A reusable structural pattern saved from a PDF import. Promote a recipe to make future imports of similar PDFs more accurate.

**Corpus** — The library of forms / recipes the importer has previously seen. Stored on disk for the CLI; not user-facing in the browser builder.

**Baseline** — A snapshot of the form used by the **Audit** tab to compute diffs against the current state.

## Rules and logic

**Rule / Condition** — A logical expression like *Field equals Value*. Used for show/hide, required-when, and other branching. See [Conditions](05-conditions.md).

**Operator** — The comparison part of a rule (`equals`, `greaterThan`, `in`, etc.).

**Computed value** — A derived value calculated from other fields. See [Computed values](08-computed-values.md).

**Handler** — An automation that listens for an event and runs actions. See [Handlers and actions](07-handlers-and-actions.md).

**Action** — One step inside a handler — set a value, set visibility, etc.

**Event** — Something that fires a handler: `field.change`, `page.enter`, `form.submit`, etc.

## Validation

**Built-in validation** — A check the form runs automatically based on field properties (required, min/max length, pattern, etc.).

**Custom validation** — A user-authored rule with a custom error message, attached to a field.

## Prefill

**Prefill** — Auto-populating fields from platform-provided data (the user's profile or other backend sources) when the form loads. See [Prefill](09-prefill.md).

**Source path** — Dotted path identifying a piece of platform data, e.g., `profile.email`.

**Target field** — The form field that receives prefilled data.

## Output and integration

**`formConfig`** — The compiled output of a form. A JavaScript module the VA forms-system runtime uses to render and process the form on VA.gov.

**vets-website** — The codebase that hosts most VA.gov forms. The integration target for compiled `formConfig` modules.

**vets-website forms-system / VA forms-system / `vaFormsSystem`** — A library inside `vets-website` that turns a `formConfig` into a working multi-step form with pagination, validation, and submission. Your form's compiled output speaks this library's conventions.

**USWDS (US Web Design System)** — The federal design system VA.gov is built on. The default builder preview style.

**shadcn / shadcn/ui** — A modern component library available as an alternative builder preview, mainly for design exploration. Not used for VA.gov production output.

**Submit transform** — A function that converts the form's collected answers into the payload sent to the backend on submit. The builder generates this from your computed values and form structure.

**Submit URL** — The backend endpoint receiving the form payload. Set in **Setup**.

**Tracking prefix** — Prefix for the analytics events emitted by the form. Set in **Setup**.

**Root URL** — The path the form lives at on VA.gov, e.g., `/employment-questionnaire-form-21-4140`. Set in **Setup**.

## PDFs

**AcroForm** — A PDF with embedded form fields (text inputs, checkboxes, etc.) — the kind PDF import works best on.

**Static text** — PDF text that isn't part of an AcroForm field. The importer extracts this to find labels.

## Files / formats

**`*-authoring.json`** — A saved authoring file. The canonical record for a form.

**`source.pdf`** — Sidecar copy of the original PDF kept alongside an imported form (CLI only).

**`import-report.json`** — Statistics file produced by the CLI importer (component counts, confidence bands, validation errors).

**Local storage** — Browser-side persistence the builder uses for auto-save. Not durable across browsers / machines.

## LLM enrichment (engineer-side, mentioned in the import flow)

**Ollama** — Local LLM runtime. Default provider for PDF-import enrichment.

**`llama3.1:8b`, `qwen2.5:14b`** — Open-weight model identifiers commonly used with Ollama.

**Anthropic Claude API / `ANTHROPIC_API_KEY`** — Cloud LLM option for higher-quality enrichment. Opt-in.

## Statuses

**Supported** — A field type that's fully authored and generated into VA.gov output.

**Preview Only** — A field type that exists in the builder palette and previews but isn't yet generated. Don't ship a form depending on these.
