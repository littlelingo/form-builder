# 11. Preview and test

The builder gives you three ways to look at your form:

1. **Edit canvas** — what you've been using all along; structural editor.
2. **Preview canvas** — read-only rendering, no editing.
3. **Run** — interactive simulator; fill out the form like an end user.

Plus a **Code** view for engineer handoff.

<!-- TODO: screenshot — Run mode mid-form with sample data, validation error visible -->

## Switching views

In the header strip:

- **Workspace** selector → choose between **Canvas**, **Run**, **Code**.
- **Canvas mode** toggle (within Canvas) → **Edit** or **Preview**.

## Edit canvas

The default. Drag from the **Build** palette, click to select, drop into the canvas, configure in the Inspector. Drop zones appear between fields. Inline actions (delete, duplicate) live on each field.

## Preview canvas

Same visual rendering as Edit, with editing turned off. Useful for:

- A clean view of what the form will look like.
- Showing stakeholders without risk of accidental edits.
- Quickly checking layout (multi-column widths, alert types, content blocks).

You can't fill it out — it's static. For interaction, switch to Run.

## Run mode

A real-time, interactive simulator. The form behaves the way it will on VA.gov.

### What you can do

- **Fill out fields** — text, dates, files, the works. The runtime validates as the user would experience.
- **See conditional show/hide live** — a field with a `showIf` rule appears and disappears as you toggle the controlling field.
- **Watch computed values** — live recalculation.
- **Trigger event handlers** — `field.change`, `page.enter`, etc. all fire as expected.
- **See validation errors** — exactly the messages users will see; styled the same way.
- **Click Continue / Back** — moves between pages with full validation.
- **Submit** — the simulator collects everything, applies the submit transform, and shows the final payload.
- **Reset** — clear all answers, start over.

### What's simulated vs. real

| Behaviour | Real or simulated? |
|-----------|---------------------|
| Validation | Real — same engine VA.gov runs. |
| Conditional logic | Real. |
| Computed values | Real. |
| Event handlers | Real. |
| Prefill | **Simulated** — Run mode doesn't fetch actual profile data. Use sample answers to mimic prefilled state. |
| File upload | **Simulated** — files aren't actually POSTed; their metadata is captured. |
| Submit | **Simulated** — the payload is shown, not sent. |

### Sample answer picker

Some pages expose quick-fill controls so you can rapidly populate a page with realistic data and skip ahead. Useful for testing late-stage logic without typing every field every time.

## Preview system toggle

Header → **Preview system** dropdown → **USWDS** or **shadcn/ui**. Switches the rendering language for the canvas and Run views. The compiled output is unchanged — this only affects the in-builder preview.

Use it to:

- Default to USWDS for VA work.
- Switch to shadcn briefly for design exploration or non-VA contexts.

## Code view

Two read-only views in the **Code** workspace:

- **Authoring JSON** — your saved source. Same content as the downloaded `*-authoring.json`.
- **Generated `formConfig`** — the compiled VA forms-system module ready to integrate.

A status badge shows **Valid** or **Invalid (n issues)** with a list of problems below. Fix any issues in the Inspector, then re-check.

## What to test

A short test checklist before declaring a form done:

- [ ] **Required-field happy path** — fill out everything, get to submit cleanly.
- [ ] **Required-field validation** — leave required fields blank; verify each error message reads naturally.
- [ ] **Custom validation** — for every custom validation rule, force a fail and verify the message.
- [ ] **Show/hide rules** — toggle every controlling field through every value.
- [ ] **Required-when rules** — same.
- [ ] **List loops** — add an item, edit it, delete it, add a second.
- [ ] **Edge dates** — try the boundary of any min/max date range.
- [ ] **Long text** — paste a paragraph into single-line fields; verify max-length errors.
- [ ] **File upload** — try a too-big file, a wrong type, multiple files.
- [ ] **Computed values** — verify each one against a hand calculation on at least one input set.
- [ ] **Submit payload** — read the final payload at submit; verify all the fields you expect are there with the shape you expect.
- [ ] **Go back, change an answer, continue** — verify everything updates (a common bug surface).

## Tips

- **Run mode is your debugger.** When something doesn't behave the way you expect, Run mode is faster than reading JSON.
- **The Code panel surfaces validation issues.** If a form looks fine in Edit mode but the Code panel says **Invalid**, fix those issues — the generator will refuse to ship.
- **Compare USWDS and shadcn if a layout seems off.** If something looks broken in only one preview, it's likely a styling issue in that system, not your form.

## Related

- [Field reference](04-field-reference.md)
- [Conditions](05-conditions.md)
- [Save, export, publish](13-save-export-publish.md)
