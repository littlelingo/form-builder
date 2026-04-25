# 5. Conditions (show/hide, required-if)

Conditions are the rules that make your form respond to what the user has answered. They power **show/hide**, **required-if**, conditional **validations**, conditional **actions**, and conditional **computed values**. Once you understand the rule builder, you understand all of them.

<!-- TODO: screenshot — Condition editor with one simple rule and one nested AND group -->

## Where conditions appear

| Location | What the rule controls |
|----------|------------------------|
| **Chapter** → "Show this chapter when…" | Whether the entire chapter appears. |
| **Page** → "Show this page when…" | Whether the page appears. |
| **Field** → "Show this field when…" | Whether the field appears. |
| **Field** → "Hide this field when…" | Inverse of show. |
| **Field** → "Required when…" | Make the field conditionally required. |
| **Validation rule** → "Apply when…" | Run a custom validation only sometimes. |
| **Event handler** → "Run when…" | Gate an action on a rule. |
| **Computed value** → "Calculate when…" | Run a computation only when relevant. |

The same editor is used everywhere.

## The three modes

Every rule is one of three things:

### 1. A simple rule

`[Field] [Operator] [Value]`

Example: *Has a phone* `equals` `Yes`.

### 2. A group: **All of these** (AND)

Several child rules — all must be true.

Example: *State* `equals` `California` **AND** *Income* `is greater than` `50000`.

### 3. A group: **Any of these** (OR)

Several child rules — at least one must be true.

Example: *Employment status* `equals` `Unemployed` **OR** *Employment status* `equals` `Student`.

Groups can nest: an **All** group can contain **Any** groups, which can contain simple rules. Build whatever logic you need.

## Operators

| Operator | Reads as | Use for | Value? |
|----------|---------|---------|--------|
| `equals` | "equals" | Exact match | Single value |
| `notEquals` | "does not equal" | Inverse of equals | Single value |
| `in` | "is one of" | Match against several values | Comma-separated list |
| `notIn` | "is not one of" | Inverse of in | Comma-separated list |
| `exists` | "has a value" | Field is not blank | (none) |
| `notExists` | "is blank" | Field is blank/unanswered | (none) |
| `greaterThan` | "is greater than" | Numeric / date comparison | Single value |
| `greaterThanOrEqual` | "is greater than or equal to" | Numeric / date comparison | Single value |
| `lessThan` | "is less than" | Numeric / date comparison | Single value |
| `lessThanOrEqual` | "is less than or equal to" | Numeric / date comparison | Single value |

The editor only shows a value input when the operator needs one (so `has a value` and `is blank` don't show one).

## Values

The editor stores values as the right type automatically:

- `true` / `false` → boolean
- `42` / `3.14` → number
- anything else → string

For `is one of` / `is not one of`, type a comma-separated list (`A, B, C`) or use newlines.

## Worked examples

### Show a phone field only if the user said they have a phone

1. Add a Yes/No field. Label it *Do you have a phone?*. Give it the ID `hasPhone`.
2. Add a Phone field below. Give it the ID `phone`.
3. Select the Phone field. In its **Properties** tab, find **Show this field when**.
4. Click **Add a rule** → choose `Has phone (hasPhone)` → operator `equals` → value `true`.
5. Switch to **Run** mode. The Phone field disappears until you click *Yes*.

### Require contact info only for dependents

1. Top page asks *Are you the veteran or a dependent?* — radio with values `veteran` and `dependent`. Give it the ID `applicantType`.
2. On a contact field, set **Required when** → `Applicant type (applicantType)` `equals` `dependent`.

### Require evidence if either of two flags is set

1. On the evidence file-upload field, set **Required when** → click **Any of these** instead of a simple rule.
2. Add child rule 1: `Has prior denial (priorDenial) equals true`.
3. Add child rule 2: `Claim is pre-2020 (preCutoff) equals true`.

The field is required when either is true.

### Show a "you're all set" alert at the end

1. Final page → drop an **Alert** field.
2. Set its **Show this field when** to a rule that checks the user has answered everything you care about — e.g., `email exists` AND `phone exists` (use an **All of these** group).

## Tips

- **Reference fields by ID, not label.** When you rename a field's label later, conditions still work because they bind to the ID. Renaming a field's **ID** breaks any condition that referenced it; the rule editor will show the broken field as missing.
- **Keep it shallow.** Deeply nested rules become hard to reason about. If a rule grows past two levels of nesting, split logic into a [computed value](08-computed-values.md) and reference that instead.
- **Test in Run mode.** Visibility changes and required-if behaviour are visible immediately when you fill the form in [Run mode](11-preview-and-test.md).
- **Conditions on chapters cascade.** If a chapter is hidden, its pages and fields are hidden too — you don't need to repeat the rule on each child.

## Related

- [Validations](06-validations.md) — conditional validations use the same rule builder.
- [Handlers and actions](07-handlers-and-actions.md) — actions can be gated by conditions.
- [Computed values](08-computed-values.md) — for logic that's reused in multiple rules, derive it once and reference the computed value.
