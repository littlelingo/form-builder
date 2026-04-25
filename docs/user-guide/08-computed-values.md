# 8. Computed values

A **computed value** is a field-like value the form derives from other answers — it isn't typed by the user. Use computed values for summary text, totals, derived flags, or to centralize logic that several rules depend on.

Computed values run in three places:

1. **Preview / Edit canvas** — visible as you build.
2. **Run mode** — recalculates as the user fills the form.
3. **Generated submit transform** — included in the final payload sent to the backend.

<!-- TODO: screenshot — Computed values editor showing one concat and one sum -->

## Where you configure them

**Setup** tab → **Computed values** section → **Add computed value**.

Each computed value has:

| Property | What it does |
|----------|--------------|
| **ID** | Unique within the form (e.g., `contactSummary`). Auto-suggested. |
| **Target** | The data path the result is written to (e.g., `metadata.contactSummary`). Engineers reference this in the submit payload. |
| **Operation** | What kind of computation (see below). |
| **Sources** | The input field IDs the operation reads (one per line for most operations). |
| **Operation-specific options** | E.g., `separator` for **Join text**, `valueMap` for **Map value**. |
| **Calculate when…** *(optional)* | A [condition](05-conditions.md) — only run this computation when the rule is true. Otherwise the target is left untouched. |

## Operations

| Operation | What it produces | Sources / config |
|-----------|------------------|-------------------|
| **Literal value** | A fixed value you type in. | One literal value (string, number, boolean). |
| **Join text** (`concat`) | Sources joined as text with an optional separator. | List of source field IDs + a separator. |
| **Sum numbers** (`sum`) | Numeric sum of all sources. | List of source field IDs. |
| **Subtract numbers** (`subtract`) | First source minus the rest. | List of source field IDs. |
| **Multiply numbers** (`multiply`) | Product of all sources. | List of source field IDs. |
| **Divide numbers** (`divide`) | First source divided by the rest in order. | List of source field IDs. |
| **First present value** (`coalesce`) | The first source that has a value. | List of source field IDs (priority order). |
| **Map value** (`mapValue`) | Looks up the source's value in a key→value table. | One source + a `key|value` table (one entry per line). |
| **Any source is true** (`booleanAny`) | `true` if any source is truthy. | List of source field IDs. |
| **All sources are true** (`booleanAll`) | `true` only if every source is truthy. | List of source field IDs. |

## Worked examples

### Contact summary (joined text)

You want a single line summarizing the user's contact info to show on the review page and include in the submit payload.

- **ID:** `contactSummary`
- **Target:** `metadata.contactSummary`
- **Operation:** *Join text*
- **Sources:** `email`, `phone`
- **Separator:** ` | `

Result: `jane@example.com | 555-555-5555`.

### Total monthly income (sum)

- **ID:** `monthlyIncomeTotal`
- **Target:** `data.monthlyIncomeTotal`
- **Operation:** *Sum numbers*
- **Sources:** `wages`, `selfEmploymentIncome`, `rentalIncome`

### Has any disability flag (any-true)

- **ID:** `hasAnyDisability`
- **Target:** `metadata.hasAnyDisability`
- **Operation:** *Any source is true*
- **Sources:** `physicalDisability`, `mentalDisability`, `serviceConnectedDisability`

Now you can reference `hasAnyDisability` in [Conditions](05-conditions.md) instead of repeating the OR rule everywhere.

### Map an internal code to a label (map value)

- **ID:** `disabilityCategoryLabel`
- **Target:** `metadata.disabilityCategoryLabel`
- **Operation:** *Map value*
- **Source:** `disabilityCategory`
- **Map:**
  ```
  PHY|Physical
  MEN|Mental
  SC|Service-connected
  ```

If `disabilityCategory` is `PHY`, the result is `Physical`.

### Pick the first email we have (coalesce)

- **ID:** `effectiveEmail`
- **Target:** `data.effectiveEmail`
- **Operation:** *First present value*
- **Sources:** `personalEmail`, `workEmail`, `profile.email`

Returns whichever of those is set first; useful when the user can answer in more than one place.

## Computed values vs handlers

Both can derive data. Use a computed value when:

- The result is a **pure function** of inputs — no side effects.
- It runs whenever inputs change — you don't need to tie it to a specific event.
- You want to reference it in conditions and validations.

Use a [handler with a `setValue` action](07-handlers-and-actions.md) when:

- The derivation is tied to a specific event (`page.enter`, `form.beforeSubmit`).
- You need to set a property other than a value (label, options, visibility).
- The logic is one-shot or branchy.

## Tips

- **Name targets clearly.** `metadata.*` is conventional for derived values that aren't user-facing answers; `data.*` for data passed to backends; pick something readable.
- **Reference computed IDs in conditions.** Centralizing logic once, then referencing the computed value, is far easier to maintain than repeating the same compound rule.
- **Watch types.** *Sum* on string fields will probably misbehave. Use number-typed text inputs (`inputType: number`) for numeric sums.
- **Use `Calculate when…` to skip expensive logic.** If a computed value only matters when a flag is set, gate it.

## Related

- [Handlers and actions](07-handlers-and-actions.md)
- [Conditions](05-conditions.md)
- [Save, export, publish](13-save-export-publish.md) — computed values appear in the generated submit transform.
