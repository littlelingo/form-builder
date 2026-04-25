# 7. Handlers and actions

Handlers and actions let your form **react** to events. When something happens (a field changes, a page is entered, the form is submitted), one or more **actions** run. Each action can be gated by a [condition](05-conditions.md).

This is the engine that powers most automation in the builder: prefilling derived fields, dynamically requiring fields, showing alerts, etc.

> If you only need to show or hide a field based on an answer, use [Conditions](05-conditions.md) instead — it's simpler. Reach for handlers when you need to **change** something (set a value, toggle a property, emit an event), not just **show** something.

<!-- TODO: screenshot — Events section in the Setup tab with one handler and two actions -->

## Where handlers live

| Where | Scope |
|-------|-------|
| **Setup** tab → **Events** section | Form-level handlers. Can listen to any event, including `form.submit`. |
| **Properties** tab on a field → **Events** section | Field-scoped handlers. Limited to `field.change`, `field.focus`, `field.blur` for that field. |

## Events (the triggers)

| Event | When it fires |
|-------|---------------|
| **Field changes** (`field.change`) | A field's value changes. |
| **Field focused** (`field.focus`) | The user tabs / clicks into a field. |
| **Field blurred** (`field.blur`) | The user tabs / clicks out of a field. |
| **Page entered** (`page.enter`) | A page becomes visible (the user navigates onto it). |
| **Before submit** (`form.beforeSubmit`) | Just before the form submits — last chance to massage data. |
| **Form submit** (`form.submit`) | The form has been submitted. |

A handler picks one event. You can have many handlers per form.

## Actions (what runs)

When the event fires, the handler executes its actions in order. Each action does one thing.

### Set answer value (`setValue`)
Write a value to another field.

- **Target** — the field receiving the value.
- **Source** — where the value comes from:
  - `event.value` — the value of the field that triggered the event.
  - `values.[fieldId]` — the current answer of any field.
  - `components.[id].[property]` — a runtime property of any component.
  - **Literal** — a typed-in constant (`true`, `42`, `"Hello"`).

### Set component property (`setComponentProperty`)
Change any property of a component dynamically — label, hint, options, etc.

- **Target component**, **Property name**, **Value source** (same as above).

### Set visibility (`setVisibility`)
Show or hide another component.

- **Target component**, **Value** (`true` = show, `false` = hide).

### Set required (`setRequired`)
Toggle whether a field is required.

- **Target component**, **Value** (`true` = required, `false` = optional).

### Set validation message (`setValidationMessage`)
Push a custom error message onto a field — useful when an external rule says the field's answer is bad even though local validation passed.

- **Target component**, **Message**.

### Emit event (`emitEvent`)
Fire another named event so other handlers can react. Lets you compose chains.

- **Event name**, **Payload**.

## Conditional actions

Each handler **and** each action can have a condition. The action only runs when the condition is true. The same rule editor as [Conditions](05-conditions.md).

This is what makes handlers feel like simple "if/then" automations.

## Worked example

**Goal:** when the user picks *Dependent* as applicant type, automatically show the Dependent contact section and mark its email field required.

1. Open **Setup** → **Events** → **Add handler**.
2. Configure the handler:
   - **Event:** *Field changes*
   - **Run when:** `applicantType equals "dependent"`
3. Add action 1:
   - Type: **Set visibility**
   - Target: `dependentContact` (the section group)
   - Value: `true`
4. Add action 2:
   - Type: **Set required**
   - Target: `dependentEmail`
   - Value: `true`
5. Add a second handler (separate "if not" path):
   - **Event:** *Field changes*
   - **Run when:** `applicantType notEquals "dependent"`
   - Action 1: **Set visibility** of `dependentContact` to `false`.
   - Action 2: **Set required** of `dependentEmail` to `false`.

Test it in [Run mode](11-preview-and-test.md): toggling the applicant-type radio reveals or hides the contact section.

## Handlers vs conditions vs computed values — when to use which

| Need | Tool |
|------|------|
| Show a field only when a condition is met | **[Show this field when…](05-conditions.md)** |
| Make a field required only when a condition is met | **[Required when…](05-conditions.md)** |
| Compute a derived value once, used in many places | **[Computed values](08-computed-values.md)** |
| Set a field's value when another field changes | **`setValue` action** in a handler |
| Override a property at runtime (label, options) | **`setComponentProperty` action** |
| Re-run logic on a specific lifecycle event (page enter, before submit) | **Handler with `page.enter` / `form.beforeSubmit`** |

If a static condition gives you what you want, prefer that — handlers are more powerful but less declarative and harder to audit.

## Tips

- **Order matters.** Actions in a handler run top-to-bottom. If action 2 needs a value action 1 wrote, it works; if it's the other way around, swap them.
- **Use `emitEvent` sparingly.** Cascading events make debugging hard. If you find yourself chaining three or more emits, the logic probably belongs in a [computed value](08-computed-values.md).
- **Avoid loops.** Don't set field A from field B's `change` event and field B from field A's `change` event. The runtime guards against true infinite loops, but it's still confusing.
- **Test every branch.** Run mode is the fastest way; toggle every triggering field through every relevant value.

## Related

- [Conditions](05-conditions.md)
- [Computed values](08-computed-values.md)
- [Preview and test](11-preview-and-test.md)
