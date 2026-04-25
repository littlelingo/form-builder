# VA Form Builder — User Guide

A task-oriented guide for **non-engineers** who use the VA Form Builder to design, configure, preview, and hand off VA-style forms.

## Who this guide is for

- **VA form authors, designers, content strategists** — the people who decide what a form should ask, in what order, with what wording.
- **Partner-team contributors** working on VA forms (vets-website, eBenefits, etc.).
- Anyone who wants to assemble a working form without writing code.

> If you are an engineer integrating compiled output into `vets-website`, see the engineer-facing docs at the project root: [`pdf-import-and-standards.md`](../../pdf-import-and-standards.md), [`form-route-to-va-gov.md`](../../form-route-to-va-gov.md), [`import-llm-providers.md`](../../import-llm-providers.md).

## What this builder does

Drag-and-drop interface that produces:

1. **Authoring JSON** — your saved source-of-truth form definition.
2. **Generated `formConfig` code** — a runnable VA forms-system module that an engineer can drop into `vets-website`.

The builder also imports existing **AcroForm PDFs** and converts them into authoring JSON to give you a head start.

## Reading order

| # | Page | What you'll learn |
|---|------|------|
| 1 | [Getting started](01-getting-started.md) | Run the builder locally, build your first form in 10 minutes. |
| 2 | [Builder tour](02-builder-tour.md) | Every panel, tab, and button — what each does. |
| 3 | [Form structure](03-form-structure.md) | How chapters, pages, and fields fit together. |
| 4 | [Field reference](04-field-reference.md) | Every field type, its properties, and when to use it. |
| 5 | [Conditions (show/hide, required-if)](05-conditions.md) | Branching forms with the rule builder. |
| 6 | [Validations](06-validations.md) | Per-field validation rules and custom error messages. |
| 7 | [Handlers and actions](07-handlers-and-actions.md) | Automation: react to events with actions. |
| 8 | [Computed values](08-computed-values.md) | Derive values from answers. |
| 9 | [Prefill](09-prefill.md) | Auto-fill fields from backend / profile data. |
| 10 | [Form settings](10-form-settings.md) | Title, ID, URLs, tracking, design system. |
| 11 | [Preview and test](11-preview-and-test.md) | Edit / Preview / Run modes; testing with sample data. |
| 12 | [Import a PDF](12-import-pdf.md) | Convert an existing AcroForm PDF into a form. |
| 13 | [Save, export, publish](13-save-export-publish.md) | Save to disk, export, hand off to engineers. |
| 14 | [Standards audit](14-standards-audit.md) | Built-in accessibility and standards checks. |
| 15 | [Templates and examples](15-templates.md) | Custom templates and the bundled example forms. |
| — | [Glossary](glossary.md) | Plain-language definitions for every term. |

## Quick start

```bash
git clone <this-repo>
cd form-builder
npm install
npm run builder:dev
```

Open `http://localhost:5173` in your browser. The app loads with a blank form and auto-restores your last session.

Continue with [Getting started](01-getting-started.md).

## Conventions in this guide

- **UI labels** — words you see in the app — appear in **bold** (e.g., **Save**, **Open JSON**).
- File and code identifiers appear in `monospace` (e.g., `formId`, `21-4140-authoring.json`).
- VA-specific terms (formConfig, vets-website, USWDS, etc.) are defined in the [Glossary](glossary.md). The first mention on each page links there.
- Some fields are marked **Preview Only** — they exist in the builder palette but do not yet generate VA.gov output. Don't ship a form that depends on them.
