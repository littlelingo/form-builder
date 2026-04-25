# 14. Standards audit

The builder includes two automated review panels. Both live in the right Inspector.

| Tab | Purpose |
|-----|---------|
| **Standards** | Continuous checklist against VA / USWDS form standards (accessibility, label length, hint text, etc.). |
| **Audit** | Compare the current form against a saved baseline; surface the diff. |

These are quality gates, not blockers — the form still saves and compiles even if the audit shows issues. But you should fix anything flagged before handing off.

<!-- TODO: screenshot — Standards tab with a couple of warnings and one error -->

## Standards tab

Click the **Standards** tab in the Inspector to see a checklist applied to your whole form. Issues are grouped by severity:

| Severity | What it means | What to do |
|----------|---------------|------------|
| **Error** | A clear violation. Will hurt accessibility, screen-reader UX, or VA.gov compliance. | Fix before shipping. |
| **Warning** | A likely issue. Often justified, but should be deliberate. | Review; either fix or document why you kept it. |
| **Info** | Style / consistency note. | Optional polish. |

### Common checks

- **Label length** — labels should be concise (e.g., under 80 chars).
- **Hint text usage** — long instructions belong in **Hint** or page **Body text**, not the field label.
- **Required-field visibility** — required fields should be marked clearly.
- **USWDS component usage** — fields should use approved component types.
- **Page density** — pages with too many fields are flagged.
- **Heading structure** — chapter / page / field heading hierarchy.
- **Accessible names** — every field has a meaningful label or `aria-label` equivalent.

Click any issue to jump to the offending field; the Inspector switches to **Properties** so you can fix it on the spot.

## Audit tab

Use the Audit tab to detect **changes** between the current form and a saved baseline. Useful when:

- Reviewing edits after a colleague's changes.
- Confirming you haven't broken anything during a refactor.
- Tracking how a form has evolved over time.

### Workflow

1. **Set baseline** — captures the current form as the comparison point.
2. **Make changes** — edit, add, remove fields.
3. **Open Audit tab** — the diff is computed and displayed: added components, removed components, changed properties.
4. **Update baseline** — once changes are reviewed, set the new state as the baseline.

The Audit tab is purely for human review — it doesn't enforce or block anything. Your team's process decides whether a baseline mismatch is acceptable.

## Tips

- **Run Standards before every Save.** Five minutes here saves a review-cycle round trip.
- **Don't ignore warnings without a reason.** If you keep a flagged item, leave a note in your team's tracker (the builder doesn't store the reason).
- **Use Audit during reviews.** Before approving someone else's changes, compare against the baseline you reviewed previously.
- **A failing Standards run doesn't break the build.** The form still saves and compiles. The audit is informational; your engineering / accessibility team enforces the bar.

## Related

- [Field reference](04-field-reference.md) — many Standards rules check field properties; understanding the field options helps fix flagged issues.
- [Save, export, publish](13-save-export-publish.md)
