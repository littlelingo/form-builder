import type { AuthoringComponent, ComponentValidation } from '../types';
import { ConditionEditor } from './ConditionEditor';

interface FieldValidationsEditorProps {
  availableFields: AuthoringComponent[];
  component: AuthoringComponent;
  onChange: (validations: ComponentValidation[] | undefined) => void;
}

function uniqueValidationMessage(validations: ComponentValidation[]) {
  let index = validations.length + 1;
  let message = `Custom validation ${index} failed.`;
  while (validations.some(validation => validation.message === message)) {
    index += 1;
    message = `Custom validation ${index} failed.`;
  }
  return message;
}

function defaultValidation(validations: ComponentValidation[]): ComponentValidation {
  return {
    message: uniqueValidationMessage(validations),
    rule: {
      field: '$field',
      operator: 'exists',
    },
  };
}

export function FieldValidationsEditor({
  availableFields,
  component,
  onChange,
}: FieldValidationsEditorProps) {
  const validations = component.validations || [];

  function updateValidation(index: number, patch: Partial<ComponentValidation>) {
    onChange(
      validations.map((validation, validationIndex) =>
        validationIndex === index ? { ...validation, ...patch } : validation,
      ),
    );
  }

  function addValidation() {
    onChange([...validations, defaultValidation(validations)]);
  }

  function removeValidation(index: number) {
    const next = validations.filter((_, validationIndex) => validationIndex !== index);
    onChange(next.length ? next : undefined);
  }

  return (
    <div className="builder-form-section">
      <div className="builder-card__header builder-card__header--split builder-card__header--compact">
        <div>
          <h3>Custom validations</h3>
          <p className="builder-muted">
            These rules run against the current field value and form data.
          </p>
        </div>
        <button className="usa-button usa-button--secondary" type="button" onClick={addValidation}>
          Add rule
        </button>
      </div>

      {validations.length === 0 && (
        <p className="builder-condition__empty">No custom validation rules have been added.</p>
      )}

      {validations.map((validation, index) => (
        <div className="builder-mapping-row" key={`${component.id}-validation-${index}`}>
          <div>
            <label className="usa-label" htmlFor={`validation-message-${component.id}-${index}`}>
              Error message
            </label>
            <input
              className="usa-input"
              id={`validation-message-${component.id}-${index}`}
              value={validation.message}
              onChange={event => updateValidation(index, { message: event.target.value })}
            />
          </div>

          <ConditionEditor
            availableFields={availableFields}
            condition={validation.rule}
            extraFields={[{ id: '$field', label: 'Current field value ($field)' }]}
            label="Fail this validation unless"
            onChange={rule => {
              if (rule) updateValidation(index, { rule });
            }}
          />

          <button
            className="usa-button usa-button--unstyled builder-remove-link"
            type="button"
            onClick={() => removeValidation(index)}
          >
            Remove validation
          </button>
        </div>
      ))}
    </div>
  );
}
