import type { AuthoringComponent, AuthoringForm } from '../types';
import { ComputedValuesEditor } from './ComputedValuesEditor';
import { EventHandlersEditor } from './EventHandlersEditor';
import { InspectorSection } from './InspectorSection';

interface MetadataEditorProps {
  availableFields: AuthoringComponent[];
  form: AuthoringForm;
  onChange: (patch: Partial<AuthoringForm>) => void;
}

export function MetadataEditor({ availableFields, form, onChange }: MetadataEditorProps) {
  const prefill = form.prefill || {};
  const mappings = prefill.mappings || [];

  function updatePrefill(nextPrefill: AuthoringForm['prefill']) {
    onChange({ prefill: nextPrefill });
  }

  function updateMapping(index: number, patch: Partial<(typeof mappings)[number]>) {
    updatePrefill({
      ...prefill,
      mappings: mappings.map((mapping, mappingIndex) =>
        mappingIndex === index ? { ...mapping, ...patch } : mapping,
      ),
    });
  }

  function addMapping() {
    updatePrefill({
      ...prefill,
      mappings: [...mappings, { source: '', target: '' }],
    });
  }

  function removeMapping(index: number) {
    updatePrefill({
      ...prefill,
      mappings: mappings.filter((_, mappingIndex) => mappingIndex !== index),
    });
  }

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="metadata-heading">
      <div className="builder-card__header">
        <p className="builder-eyebrow">Form setup</p>
        <h2 id="metadata-heading">Metadata</h2>
      </div>

      <label className="usa-label" htmlFor="form-title">
        Internal title
      </label>
      <input
        className="usa-input"
        id="form-title"
        value={form.title}
        onChange={event => onChange({ title: event.target.value })}
      />

      <label className="usa-label" htmlFor="form-header">
        Plain-language heading
      </label>
      <input
        className="usa-input"
        id="form-header"
        value={form.plainLanguageHeader || ''}
        onChange={event => onChange({ plainLanguageHeader: event.target.value })}
      />

      <div className="builder-two-column">
        <div>
          <label className="usa-label" htmlFor="form-id">
            Form ID
          </label>
          <input
            className="usa-input"
            id="form-id"
            value={form.formId}
            onChange={event => onChange({ formId: event.target.value })}
          />
        </div>
        <div>
          <label className="usa-label" htmlFor="definition-version">
            Definition version
          </label>
          <input
            className="usa-input"
            id="definition-version"
            min="1"
            type="number"
            value={form.formDefinitionVersion || 1}
            onChange={event =>
              onChange({ formDefinitionVersion: Number(event.target.value) || 1 })
            }
          />
        </div>
      </div>

      <label className="usa-label" htmlFor="submit-url">
        Submission endpoint
      </label>
      <input
        className="usa-input"
        id="submit-url"
        value={form.submitUrl || ''}
        onChange={event => onChange({ submitUrl: event.target.value })}
      />

      <div className="usa-checkbox builder-checkbox">
        <input
          className="usa-checkbox__input"
          id="prefill-enabled"
          type="checkbox"
          checked={Boolean(prefill.enabled)}
          onChange={event =>
            updatePrefill({
              ...prefill,
              enabled: event.target.checked,
            })
          }
        />
        <label className="usa-checkbox__label" htmlFor="prefill-enabled">
          Enable prefill metadata
        </label>
      </div>

      {prefill.enabled && (
        <InspectorSection defaultOpen eyebrow="Prefill" title="Backend mappings">
          <div className="builder-card__header builder-card__header--split">
            <div>
              <h3>Backend mappings</h3>
            </div>
            <button className="usa-button usa-button--secondary" type="button" onClick={addMapping}>
              Add mapping
            </button>
          </div>

          {mappings.length === 0 && (
            <p className="usa-prose">No prefill mappings have been added.</p>
          )}

          {mappings.map((mapping, index) => (
            <div className="builder-mapping-row" key={`prefill-mapping-${index}`}>
              <div className="builder-two-column">
                <div>
                  <label className="usa-label" htmlFor={`prefill-source-${index}`}>
                    Source path
                  </label>
                  <input
                    className="usa-input"
                    id={`prefill-source-${index}`}
                    placeholder="profile.email"
                    value={mapping.source}
                    onChange={event => updateMapping(index, { source: event.target.value })}
                  />
                </div>
                <div>
                  <label className="usa-label" htmlFor={`prefill-target-${index}`}>
                    Target field
                  </label>
                  <input
                    className="usa-input"
                    id={`prefill-target-${index}`}
                    placeholder="email"
                    value={mapping.target}
                    onChange={event => updateMapping(index, { target: event.target.value })}
                  />
                </div>
              </div>
              <button
                className="usa-button usa-button--unstyled builder-remove-link"
                type="button"
                onClick={() => removeMapping(index)}
              >
                Remove mapping
              </button>
            </div>
          ))}
        </InspectorSection>
      )}

      <ComputedValuesEditor
        availableFields={availableFields}
        computedValues={form.computedValues}
        onChange={computedValues => onChange({ computedValues })}
      />

      <EventHandlersEditor
        availableFields={availableFields}
        handlers={form.eventHandlers}
        title="Form events"
        onChange={eventHandlers => onChange({ eventHandlers })}
      />
    </section>
  );
}
