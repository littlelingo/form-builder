import { useState } from 'react';

import type { BuilderExample } from '../data/exampleAuthoringForm';
import type { AuthoringForm } from '../types';

interface FormActionsProps {
  examples: BuilderExample[];
  form: AuthoringForm;
  onLoadExample: (form: AuthoringForm) => void;
}

export function FormActions({ examples, form, onLoadExample }: FormActionsProps) {
  const [message, setMessage] = useState<string>('');

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="form-actions-heading">
      <div className="builder-card__header">
        <p className="builder-eyebrow">Files</p>
        <h2 id="form-actions-heading">Examples &amp; saved templates</h2>
      </div>

      <div className="builder-example-list" aria-label="Load an example form">
        <h3>Examples</h3>
        {examples.map(example => {
          const isCurrent = example.form.formId === form.formId;
          return (
            <div className="builder-example-row" key={example.id}>
              <button
                className={`builder-example-button${isCurrent ? ' is-current' : ''}`}
                type="button"
                onClick={() => {
                  onLoadExample(example.form);
                  setMessage(`Loaded ${example.label}.`);
                }}
              >
                <span>{example.label}</span>
                <small>{example.description}</small>
              </button>
              {isCurrent && (
                <button
                  className="builder-example-reload"
                  type="button"
                  title={`Reload ${example.label}`}
                  aria-label={`Reload ${example.label}`}
                  onClick={() => {
                    onLoadExample(example.form);
                    setMessage(`Reloaded ${example.label}.`);
                  }}
                >
                  ↻
                </button>
              )}
            </div>
          );
        })}
      </div>

      {message && <p className="builder-action-message" role="status">{message}</p>}
    </section>
  );
}
