import { diffAuthoringForms, validateAuthoringForm } from '../lib/core';
import type { AuthoringForm } from '../types';

interface AuditPanelProps {
  baseline: AuthoringForm;
  form: AuthoringForm;
}

const severityLabels: Record<string, string> = {
  safe: 'Safe',
  compatible: 'Compatible',
  migrationRequired: 'Migration required',
  breaking: 'Breaking',
};

function displayValidationError(error: string) {
  if (error === 'chapters must be a non-empty array') {
    return 'Add at least one section or field before generating the form.';
  }
  if (error.includes('chapters[')) return error.replaceAll('chapters', 'sections');
  if (error.includes('.pages')) return error.replaceAll('.pages', '.screens');
  return error;
}

export function AuditPanel({ baseline, form }: AuditPanelProps) {
  const validation = validateAuthoringForm(form);
  const diff = diffAuthoringForms(baseline, form);

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="audit-heading">
      <div className="builder-card__header">
        <p className="builder-eyebrow">Governance</p>
        <h2 id="audit-heading">Audit and compatibility</h2>
      </div>

      <div className="builder-audit-summary">
        <div>
          <span>Schema validation</span>
          <strong className={validation.valid ? 'is-valid' : 'is-invalid'}>
            {validation.valid ? 'Valid' : `${validation.errors.length} issues`}
          </strong>
        </div>
        <div>
          <span>Change compatibility</span>
          <strong className={`compat-${diff.compatibility}`}>
            {severityLabels[diff.compatibility] || diff.compatibility}
          </strong>
        </div>
      </div>

      {validation.errors.length > 0 && (
        <div className="builder-audit-list">
          <h3>Validation issues</h3>
          <ul className="usa-list">
            {validation.errors.map(error => (
              <li key={error}>{displayValidationError(error)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="builder-audit-list">
        <h3>Changes from loaded baseline</h3>
        {diff.changes.length === 0 ? (
          <p>No structural changes detected.</p>
        ) : (
          <ul className="builder-change-list">
            {diff.changes.map(change => (
              <li className={`compat-${change.severity}`} key={`${change.code}-${change.message}`}>
                <strong>{severityLabels[change.severity] || change.severity}</strong>
                <span>{change.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
