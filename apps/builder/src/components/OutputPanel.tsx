import { generateVaFormConfigModule, validateAuthoringForm } from '../lib/core';
import type { AuthoringForm } from '../types';

interface OutputPanelProps {
  form: AuthoringForm;
}

function tryGenerate(form: AuthoringForm) {
  try {
    return generateVaFormConfigModule(form);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function displayValidationError(error: string) {
  if (error === 'chapters must be a non-empty array') {
    return 'Add at least one section or field before generating the form.';
  }
  if (error.includes('chapters[')) return error.replaceAll('chapters', 'sections');
  if (error.includes('.pages')) return error.replaceAll('.pages', '.screens');
  return error;
}

export function OutputPanel({ form }: OutputPanelProps) {
  const validation = validateAuthoringForm(form);
  const generatedCode = tryGenerate(form);

  return (
    <section className="builder-output" aria-label="Builder output">
      <div className="builder-output__panel">
        <div className="builder-card__header">
          <p className="builder-eyebrow">Saved source</p>
          <h2>Authoring JSON</h2>
        </div>
        <pre className="builder-code-block">{JSON.stringify(form, null, 2)}</pre>
      </div>

      <div className="builder-output__panel">
        <div className="builder-card__header builder-card__header--split">
          <div>
            <p className="builder-eyebrow">Generated artifact</p>
            <h2>Generated formConfig</h2>
          </div>
          <span className={validation.valid ? 'builder-status is-valid' : 'builder-status is-invalid'}>
            {validation.valid ? 'Valid' : `${validation.errors.length} issues`}
          </span>
        </div>

        {!validation.valid && (
          <div className="usa-alert usa-alert--error builder-alert">
            <div className="usa-alert__body">
              <h3 className="usa-alert__heading">Schema issues</h3>
              <ul className="usa-list">
                {validation.errors.map(error => (
                  <li key={error}>{displayValidationError(error)}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <pre className="builder-code-block">{generatedCode}</pre>
      </div>
    </section>
  );
}
