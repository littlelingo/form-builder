# 13. Save, export, publish

How forms move from the builder to a real VA.gov page.

## Three places your form lives

| Location | Persistence | Purpose |
|----------|-------------|---------|
| **Browser local storage** | Auto-saved, lost on cache clear / browser switch. | Working draft as you edit. |
| **Downloaded `*-authoring.json`** | Permanent (until you delete it). | Canonical record. Source of truth. |
| **Generated `formConfig` code** | Lives in `vets-website` after engineer integration. | What ships to VA.gov. |

There is **no server** behind the builder — nothing is uploaded anywhere when you click Save. Saving downloads a file to your machine.

## Save

Click **Save** in the header strip.

- A file `{formId}-authoring.json` downloads (e.g., `21-4140-authoring.json`).
- Your browser snapshot is updated.
- The asterisk (`Save *`) clears, indicating no unsaved changes.

> If your form has no `formId` set, the filename falls back to a generic name. Set the **Form ID** in the **Setup** tab before saving.

## Auto-save

Every change is auto-saved to `localStorage`. If you reload the tab, your work returns. Three keys are used (so engineers can clear them if needed):

- `va-form-builder.lastForm.v1` — the form itself
- `va-form-builder.lastSaved.v1` — signature for unsaved-changes detection
- `va-form-builder.customTemplates.v1` — your saved templates

Auto-save is **not durable** — clearing browser data, switching browsers, or switching machines loses unsaved work. Always click **Save** when you finish a session.

## Open a saved form

Click **Open JSON** → choose the file. The builder validates the JSON before loading; an invalid file is rejected with the error.

## Export JSON

In the header **More ▾** menu → **Export JSON**.

Same content as Save, but doesn't update the "clean" state. Use when you want a snapshot for sharing without disturbing your editor session.

## Copy generated code

In the **Code** workspace, the right pane shows the generated `formConfig` module. Click **Copy** to put it on the clipboard.

This is the file your engineer drops into `vets-website`. It's regeneratable — they don't typically commit it as-is; they re-run the compiler when the authoring JSON updates.

## Compile from the command line

If your engineer prefers CLI:

```bash
node src/cli/compile.mjs <authoring.json>     # prints generated code to stdout
```

Or for the bundled examples:

```bash
npm run compile:example          # 21-4140
npm run compile:example:27-8832
```

## Handing off to engineers

What to send your engineering partner:

1. **The authoring JSON** (`*-authoring.json`). Treat this as the source.
2. **Any source PDFs** if the form was imported.
3. **A list of unresolved questions** — every value you set to a placeholder (e.g., a fake `submitUrl`) so the engineer knows to wire real endpoints.

What **not** to send (or send only as reference):

- The generated `formConfig` code. Engineers regenerate from the authoring JSON; sending the generated code risks drift.

What the engineer does:

1. Drops the authoring JSON into the form-builder repo (or wherever your shared store lives).
2. Runs the compiler to produce a `formConfig`.
3. Wires that into a `vets-website` form app — usually a folder under `src/applications/`.
4. Hooks the **Submit URL** to the real backend endpoint.
5. Verifies prefill mappings against the runtime profile data.
6. Fills in test scaffolding and ships behind a feature flag.

The future "Export VA.gov app" feature (planned) will package steps 2–4 into a downloadable `vets-website` app folder. See [`form-route-to-va-gov.md`](../../form-route-to-va-gov.md) for the engineer-side roadmap.

## Versioning your forms

The builder doesn't version forms for you. Two practical approaches:

- **Git** — commit `*-authoring.json` to a repo (the form-builder project itself, or a forms repo you share with engineering).
- **File naming** — `21-4140-authoring-v2.json`, etc.

Either works. Git is preferred for serious work because diffs are visible.

## Tips

- **Save often.** Browsers can wipe local storage.
- **Set Form ID early.** Filename and engineering coordination both need it.
- **Don't edit generated code.** If you find yourself changing the `formConfig` directly, that change won't survive the next regeneration. Make the change in the builder and re-export.
- **Bump definition version when you ship a meaningful revision.** It's a hint to downstream consumers that the schema changed.

## Related

- [Form settings](10-form-settings.md) — formId, URLs, tracking prefix.
- [Templates and examples](15-templates.md) — examples ship with the project to study.
- [Glossary](glossary.md)
