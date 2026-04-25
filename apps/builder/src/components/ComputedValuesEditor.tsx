import type {
  AuthoringComponent,
  ComputedValueDefinition,
  ComputedValueOperation,
} from '../types';
import { ConditionEditor } from './ConditionEditor';
import { InspectorSection } from './InspectorSection';

interface ComputedValuesEditorProps {
  availableFields: AuthoringComponent[];
  computedValues?: ComputedValueDefinition[];
  onChange: (computedValues: ComputedValueDefinition[]) => void;
}

const operationOptions: Array<{ value: ComputedValueOperation; label: string }> = [
  { value: 'literal', label: 'Literal value' },
  { value: 'concat', label: 'Join text' },
  { value: 'sum', label: 'Sum numbers' },
  { value: 'subtract', label: 'Subtract numbers' },
  { value: 'multiply', label: 'Multiply numbers' },
  { value: 'divide', label: 'Divide numbers' },
  { value: 'coalesce', label: 'First present value' },
  { value: 'mapValue', label: 'Map value' },
  { value: 'booleanAny', label: 'Any source is true' },
  { value: 'booleanAll', label: 'All sources are true' },
];

function textValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function pathsToText(paths?: string[]) {
  return (paths || []).join('\n');
}

function textToPaths(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function mapToText(valueMap?: Record<string, unknown>) {
  return Object.entries(valueMap || {})
    .map(([key, value]) => `${key}|${textValue(value)}`)
    .join('\n');
}

function textToMap(value: string) {
  return value
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .reduce<Record<string, unknown>>((map, row) => {
      const [key, ...valueParts] = row.split('|');
      map[key.trim()] = parseValue(valueParts.join('|').trim());
      return map;
    }, {});
}

function newComputedId(computedValues: ComputedValueDefinition[]) {
  let index = computedValues.length + 1;
  let id = `computedValue${index}`;
  while (computedValues.some(item => item.id === id)) {
    index += 1;
    id = `computedValue${index}`;
  }
  return id;
}

function defaultComputedValue(computedValues: ComputedValueDefinition[]): ComputedValueDefinition {
  return {
    id: newComputedId(computedValues),
    target: '',
    operation: 'concat',
    sources: [],
    separator: ' ',
  };
}

function requiresSources(operation: ComputedValueOperation) {
  return operation !== 'literal';
}

function updateForOperation(
  definition: ComputedValueDefinition,
  operation: ComputedValueOperation,
): ComputedValueDefinition {
  const next: ComputedValueDefinition = {
    ...definition,
    operation,
  };

  if (operation === 'literal') {
    delete next.sources;
    delete next.separator;
    delete next.valueMap;
    delete next.defaultValue;
    next.value ??= '';
    return next;
  }

  delete next.value;
  next.sources ||= [];

  if (operation === 'concat') {
    next.separator ??= ' ';
  } else {
    delete next.separator;
  }

  if (operation === 'mapValue') {
    next.sources = next.sources.slice(0, 1);
    next.valueMap ||= {};
  } else {
    delete next.valueMap;
    delete next.defaultValue;
  }

  return next;
}

export function ComputedValuesEditor({
  availableFields,
  computedValues = [],
  onChange,
}: ComputedValuesEditorProps) {
  function updateComputedValue(index: number, patch: Partial<ComputedValueDefinition>) {
    onChange(
      computedValues.map((definition, definitionIndex) =>
        definitionIndex === index ? { ...definition, ...patch } : definition,
      ),
    );
  }

  function addComputedValue() {
    onChange([...computedValues, defaultComputedValue(computedValues)]);
  }

  function removeComputedValue(index: number) {
    onChange(computedValues.filter((_, definitionIndex) => definitionIndex !== index));
  }

  return (
    <InspectorSection eyebrow="Computed" title="Computed values">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <h3>Computed values</h3>
          <p className="builder-muted">
            Derived values run in preview, runner, and generated submit transforms.
          </p>
        </div>
        <button className="usa-button usa-button--secondary" type="button" onClick={addComputedValue}>
          Add computed value
        </button>
      </div>

      {computedValues.length === 0 && (
        <p className="usa-prose">No computed values have been added.</p>
      )}

      {computedValues.map((definition, index) => {
        const operation = definition.operation || 'concat';
        return (
          <div className="builder-mapping-row" key={`${definition.id}-${index}`}>
            <div className="builder-two-column">
              <div>
                <label className="usa-label" htmlFor={`computed-id-${index}`}>
                  Computed ID
                </label>
                <input
                  className="usa-input"
                  id={`computed-id-${index}`}
                  value={definition.id}
                  onChange={event => updateComputedValue(index, { id: event.target.value })}
                />
              </div>
              <div>
                <label className="usa-label" htmlFor={`computed-operation-${index}`}>
                  Operation
                </label>
                <select
                  className="usa-select"
                  id={`computed-operation-${index}`}
                  value={operation}
                  onChange={event =>
                    onChange(
                      computedValues.map((item, itemIndex) =>
                        itemIndex === index
                          ? updateForOperation(item, event.target.value as ComputedValueOperation)
                          : item,
                      ),
                    )
                  }
                >
                  {operationOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="usa-label" htmlFor={`computed-target-${index}`}>
                Target path
              </label>
              <input
                className="usa-input builder-code-input"
                id={`computed-target-${index}`}
                list="computed-target-fields"
                placeholder="metadata.contactSummary"
                value={definition.target}
                onChange={event => updateComputedValue(index, { target: event.target.value })}
              />
            </div>

            {requiresSources(operation) && (
              <div>
                <label className="usa-label" htmlFor={`computed-sources-${index}`}>
                  Source paths
                </label>
                <span className="usa-hint" id={`computed-sources-${index}-hint`}>
                  One source path per line. Use field IDs or nested paths.
                </span>
                <textarea
                  aria-describedby={`computed-sources-${index}-hint`}
                  className="usa-textarea builder-code-input"
                  id={`computed-sources-${index}`}
                  value={pathsToText(definition.sources)}
                  onChange={event =>
                    updateComputedValue(index, {
                      sources:
                        operation === 'mapValue'
                          ? textToPaths(event.target.value).slice(0, 1)
                          : textToPaths(event.target.value),
                    })
                  }
                />
              </div>
            )}

            {operation === 'literal' && (
              <div>
                <label className="usa-label" htmlFor={`computed-value-${index}`}>
                  Literal value
                </label>
                <input
                  className="usa-input"
                  id={`computed-value-${index}`}
                  value={textValue(definition.value)}
                  onChange={event => updateComputedValue(index, { value: parseValue(event.target.value) })}
                />
              </div>
            )}

            {operation === 'concat' && (
              <div>
                <label className="usa-label" htmlFor={`computed-separator-${index}`}>
                  Separator
                </label>
                <input
                  className="usa-input"
                  id={`computed-separator-${index}`}
                  value={textValue(definition.separator)}
                  onChange={event => updateComputedValue(index, { separator: event.target.value })}
                />
              </div>
            )}

            {operation === 'mapValue' && (
              <>
                <div>
                  <label className="usa-label" htmlFor={`computed-map-${index}`}>
                    Value map
                  </label>
                  <span className="usa-hint" id={`computed-map-${index}-hint`}>
                    One mapping per line. Use sourceValue|computedValue.
                  </span>
                  <textarea
                    aria-describedby={`computed-map-${index}-hint`}
                    className="usa-textarea builder-code-input"
                    id={`computed-map-${index}`}
                    value={mapToText(definition.valueMap)}
                    onChange={event => updateComputedValue(index, { valueMap: textToMap(event.target.value) })}
                  />
                </div>
                <div>
                  <label className="usa-label" htmlFor={`computed-default-${index}`}>
                    Default value
                  </label>
                  <input
                    className="usa-input"
                    id={`computed-default-${index}`}
                    value={textValue(definition.defaultValue)}
                    onChange={event =>
                      updateComputedValue(index, { defaultValue: parseValue(event.target.value) })
                    }
                  />
                </div>
              </>
            )}

            <ConditionEditor
              availableFields={availableFields}
              condition={definition.condition}
              label="Run this computed value only when"
              onChange={condition => updateComputedValue(index, { condition })}
            />

            <button
              className="usa-button usa-button--unstyled builder-remove-link"
              type="button"
              onClick={() => removeComputedValue(index)}
            >
              Remove computed value
            </button>
          </div>
        );
      })}

      <datalist id="computed-target-fields">
        {availableFields.map(field => (
          <option key={field.id} value={field.id}>
            {field.label}
          </option>
        ))}
      </datalist>
    </InspectorSection>
  );
}
