# 10. Form settings

Form-level settings live on the **Setup** tab in the right Inspector panel. They define the form's identity, where it lives on VA.gov, and how it's tracked.

<!-- TODO: screenshot — Setup tab populated with the 21-4140 example values -->

## Identity

| Setting | Required | What it does |
|---------|----------|--------------|
| **Internal title** | Yes | Working name in the builder. Doesn't appear to end users. |
| **Plain-language heading** | No | The user-facing heading at the top of the form. Should be a friendly form name (e.g., *Employment Questionnaire*). |
| **Form ID** | Yes | Unique ID — typically the VA form number (e.g., `21-4140`). Drives the saved filename, JSON payload, and engineer integration path. |
| **Subtitle** | No | Additional context shown below the heading (e.g., "VA Form 21-4140"). |
| **Definition version** | No | Number tracking the version of this authoring file. Increment when you ship a meaningful revision. |

## URLs

| Setting | What it does | Example |
|---------|--------------|---------|
| **Root URL** | The path the form lives at on VA.gov. | `/employment-questionnaire-form-21-4140` |
| **Submit URL** | Backend endpoint receiving the form payload. | `/v0/form-21-4140` |
| **Tracking prefix** | Prefix used in analytics events emitted by the form. | `21-4140-eq-` |

If you don't know these yet, leave them blank — your engineering partner can fill them in before integration.

## Component system

Determines which design system the builder previews and the generator targets.

| Choice | Use for |
|--------|---------|
| **uswds** (US Web Design System) | The default builder preview. Closest to VA.gov rendering. |
| **vaFormsSystem** | The actual generator target for VA.gov forms. Compiled output uses VA forms-system helpers. |
| **shadcn** | Optional alternative preview, for comparison or non-VA contexts. |

You can choose:

- **Primary** — what the builder UI uses for the canvas preview (USWDS recommended).
- **Generated** — what the compiled code produces (vaFormsSystem for VA.gov).
- **Preview** — alternative for the secondary preview switcher.

For most VA work, leave defaults: USWDS preview + vaFormsSystem generation.

## Other Setup-tab sections

The Setup tab also exposes:

- **Prefill** — see [Prefill](09-prefill.md).
- **Computed values** — see [Computed values](08-computed-values.md).
- **Events** — form-level handlers, see [Handlers and actions](07-handlers-and-actions.md).

## Tips

- **Form ID matters.** It's the canonical identifier engineers use; pick it before you get deep into building. Renaming it later is fine but be deliberate.
- **The internal title and plain-language heading can differ.** Use the internal title for the editor and the plain-language heading for users. The 21-4140 example uses *21-4140 Employment Questionnaire* internally and a friendlier heading for users.
- **Tracking prefix should be unique.** Two forms with the same prefix would emit indistinguishable analytics events.

## Related

- [Save, export, publish](13-save-export-publish.md) — these settings appear in the generated `formConfig`.
- [Glossary](glossary.md) — definitions of `formConfig`, `vets-website`, USWDS, etc.
