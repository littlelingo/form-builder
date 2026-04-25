# 9. Prefill

Prefill auto-populates form fields from data the platform already has — the user's **profile** (name, email, address) or other backend sources. The user sees the form already partly filled in, can edit, and continues. Prefill is what removes "type your name and email again" friction.

<!-- TODO: screenshot — Prefill section in Setup tab with a couple of mappings -->

## How it works

You declare **mappings**: pairs of *source path* (where the data is on the platform) → *target field* (which form field gets it). When the form loads on VA.gov, the platform reads the source paths from the user session / API and writes the values into the target fields.

The form-builder doesn't fetch real prefill data — that happens at runtime in `vets-website`. The builder just records the mappings.

## Where you configure it

**Setup** tab → **Prefill** section.

1. Tick **Enable prefill metadata**. This sets a `prefillEnabled: true` flag in the generated `formConfig`.
2. Click **Add mapping**.
3. For each mapping, set:
   - **Source path** — dotted path of the data on the platform. Common ones:
     - `profile.email`
     - `profile.firstName`, `profile.lastName`
     - `profile.phone`
     - `profile.address.street`, `profile.address.city`, etc.
     - Anything your engineer can wire up server-side.
   - **Target field** — pick a form field from the dropdown.

The list of available source paths is conventional, not enforced — engineers wire whatever is available in the platform's prefill response. Coordinate with your engineering partner on what's available.

## Worked example

For an employment questionnaire that already knows the veteran's contact info:

| Source path | Target field |
|-------------|--------------|
| `profile.firstName` | `firstName` |
| `profile.lastName` | `lastName` |
| `profile.email` | `email` |
| `profile.phone` | `phone` |

When the user lands on the form, the four fields are pre-populated. They can edit any of them.

The bundled **21-4140** example demonstrates this pattern — load it from the **Files** tab to see real mappings.

## What gets generated

When the form is compiled (Code panel or `npm run compile:example`), the resulting `formConfig` includes:

- `prefillEnabled: true` at the form level.
- A `prefillTransformer` that maps the runtime prefill payload into your form's data shape.

Your engineering partner doesn't have to write that boilerplate; it comes from your mappings.

## Tips

- **Start small.** Map only the fields where prefill is high-value. Over-prefilling can confuse users (e.g., prefilling fields that they're supposed to confirm).
- **Don't prefill required fields without indicating they're prefilled.** A user might miss that a value is already there. Use **Hint** text on the field to flag it.
- **Coordinate with engineers.** Confirm that each source path is actually available in the platform's prefill response for your form's eligibility. A mapping to a missing path silently writes nothing.
- **Combine prefill with [computed values](08-computed-values.md)** when the prefilled value needs reformatting before display.

## Related

- [Form settings](10-form-settings.md) — root URL and submit URL share the Setup tab.
- [Computed values](08-computed-values.md)
- [Templates and examples](15-templates.md) — see prefill mappings in the 21-4140 example.
