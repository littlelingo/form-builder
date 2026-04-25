# 6. Validations

Validations are the rules a user's answer has to satisfy. The builder gives you two layers:

1. **Built-in validations** — automatic, based on field type and properties (required, min/max length, pattern, file size, etc.).
2. **Custom validations** — extra rules you author, with custom error messages.

<!-- TODO: screenshot — Validations section in Inspector with one custom rule and a custom message -->

## Built-in validations

You don't add these — set the related property and they apply automatically.

| Field property | Built-in check | Default error |
|----------------|----------------|---------------|
| **Required** = true | The user answered. | "Please provide a response." |
| **Min length** | Answer is at least N characters. | "Please provide a longer response." |
| **Max length** | Answer is at most N characters. | "Please shorten your response." |
| **Pattern** | Answer matches the regex. | "Please match the requested format." |
| **Minimum** (Date / Range slider) | Answer ≥ minimum. | "Please enter a value at or above the minimum." |
| **Maximum** | Answer ≤ maximum. | "Please enter a value at or below the maximum." |
| **Email** field | HTML5 email format. | "Please enter a valid email." |
| **Phone** field with pattern | Format matches. | "Please enter a valid phone number." |
| **File upload** — accepted types, max/min size, max count | Each file conforms. | Per-rule message. |
| **Date** — Allow future dates = false | The date is today or past. | "Please enter a date in the past." |
| **Address** — required sub-fields | All required sub-fields filled. | Per-sub-field message. |

### Override the default messages

Each field has a **Custom error messages** section in the Properties tab. Provide your own text for any of: `required`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`. Plain language always wins ("Enter your 9-digit Social Security number" beats "Pattern mismatch").

## Custom validations

Use a custom validation when the built-ins aren't enough — cross-field checks, business rules, format quirks.

In the field's **Properties** tab, find the **Validations** section, click **Add validation**:

| Property | What it does |
|----------|--------------|
| **Message** | The error text the user sees if the rule fails. |
| **Rule** | A [condition](05-conditions.md). When the rule is **true**, validation **passes**. When false, validation fails and the message shows. |
| **Apply when…** *(optional)* | Only run this validation when this outer condition is true. Lets you skip the check in cases where it doesn't apply. |

> ⚠️ **Direction matters.** The rule expresses *the valid state*, not the failure. A validation rule of *"age greaterThanOrEqual 18"* passes when the user is 18+. The error message shows when they aren't.

### Examples

**"You must be 18 or older"**
- Field: `age` (Text input, inputType `number`)
- Rule: `age greaterThanOrEqual 18`
- Message: *You must be 18 or older to use this form.*

**"Confirm email must match email"**
- Field: `confirmEmail`
- Rule: `confirmEmail equals email`
- Message: *Confirmation email must match the email above.*

(Cross-field comparisons reference the other field by ID.)

**"At least one disability must be claimed"**
- Field: `disabilityList` (Checkbox group)
- Rule: `disabilityList exists`
- Message: *Select at least one disability.*

**"End date must be after start date"** (only run when both are set)
- Field: `endDate`
- Apply when: `startDate exists` AND `endDate exists` (group with **All of these**)
- Rule: `endDate greaterThan startDate`
- Message: *End date must be after start date.*

## When validations run

- **As the user types / picks** — soft validation hints (typically on blur).
- **When clicking Continue / Submit** — hard validation. The form will not advance with errors.
- **In [Run mode](11-preview-and-test.md)** — same behaviour as production. Use this to verify your messages make sense.

## Tips

- **Be specific.** "Please match the requested format" tells the user nothing. "Use 9 digits, no dashes (e.g., 123456789)" tells them what to do.
- **Don't validate at the wrong time.** If you check `endDate > startDate` without "Apply when both exist", the user gets an error before they've finished typing. Always gate cross-field rules on both fields existing.
- **Built-in first.** If a built-in property does the job (Pattern, Min length), use that — fewer custom rules to maintain.
- **Don't duplicate Required.** If a field is **Required**, you don't also need a custom "must not be blank" validation.

## Related

- [Conditions](05-conditions.md) — same rule builder powers validation rules and "Apply when".
- [Field reference](04-field-reference.md) — see which built-in validations each field exposes.
