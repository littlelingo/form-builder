import { useEffect, useMemo, useState } from 'react';

import type { AuthoringComponent, AuthoringForm, SelectedNode } from '../types';
import { confidenceBand } from '../lib/reviewState';

interface ImportWizardProps {
  form: AuthoringForm;
  onAccept: (componentId: string) => void;
  onJumpToComponent: (node: SelectedNode) => void;
  onClose: () => void;
}

interface WizardStep {
  component: AuthoringComponent;
  chapterId: string;
  pageId: string;
  pageTitle: string;
}

function flatten(components: AuthoringComponent[] = []): AuthoringComponent[] {
  const out: AuthoringComponent[] = [];
  for (const component of components) {
    out.push(component);
    if (Array.isArray(component.children)) {
      out.push(...flatten(component.children));
    }
  }
  return out;
}

function gatherLowBand(form: AuthoringForm): WizardStep[] {
  const steps: WizardStep[] = [];
  const importOrigins = new Set(['pdf-field', 'pdf-static-region']);
  for (const chapter of form.chapters) {
    for (const page of chapter.pages) {
      for (const component of flatten(page.components)) {
        if (!component.provenance || component.provenance.reviewed) continue;
        if (!importOrigins.has(component.provenance.origin)) continue;
        const band = confidenceBand(component.provenance.confidence);
        if (band !== 'low') continue;
        steps.push({
          component,
          chapterId: chapter.id,
          pageId: page.id,
          pageTitle: page.title,
        });
      }
    }
  }
  steps.sort((a, b) => {
    const ac = a.component.provenance?.confidence ?? 0;
    const bc = b.component.provenance?.confidence ?? 0;
    return ac - bc;
  });
  return steps;
}

function bandLabel(band: 'high' | 'medium' | 'low'): string {
  if (band === 'high') return 'High';
  if (band === 'medium') return 'Medium';
  return 'Low';
}

export function ImportWizard({ form, onAccept, onJumpToComponent, onClose }: ImportWizardProps) {
  const allSteps = useMemo(() => gatherLowBand(form), [form]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(prev => Math.min(prev, Math.max(0, allSteps.length - 1)));
  }, [allSteps.length]);

  if (allSteps.length === 0) {
    return null;
  }

  const step = allSteps[index];
  if (!step) {
    return null;
  }

  const confidence = step.component.provenance?.confidence ?? 0;
  const band = confidenceBand(confidence);
  const percent = Math.round(confidence * 100);
  const total = allSteps.length;

  return (
    <div className="builder-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="builder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-wizard-heading"
        onClick={event => event.stopPropagation()}
      >
        <header className="builder-modal__header">
          <p className="builder-eyebrow">Imported components review</p>
          <h2 id="import-wizard-heading">
            Step {index + 1} of {total}
          </h2>
          <button
            type="button"
            className="builder-modal__close"
            aria-label="Close wizard"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="builder-modal__body">
          <div className={`builder-modal__confidence builder-modal__confidence--${band}`}>
            <span className="confidence-badge__dot" aria-hidden="true" />
            {bandLabel(band)} confidence • {percent}%
          </div>

          <h3 className="builder-modal__component-label">{step.component.label}</h3>
          <p className="usa-prose builder-modal__component-meta">
            Type: <code>{step.component.type}</code> • Page: {step.pageTitle}
          </p>

          <dl className="builder-modal__meta-list">
            {step.component.provenance?.pdfFieldName && (
              <div>
                <dt>AcroForm field name</dt>
                <dd>
                  <code>{step.component.provenance.pdfFieldName}</code>
                </dd>
              </div>
            )}
            {typeof step.component.provenance?.pdfPage === 'number' && (
              <div>
                <dt>PDF page</dt>
                <dd>{step.component.provenance.pdfPage + 1}</dd>
              </div>
            )}
            {step.component.hint && (
              <div>
                <dt>Adjacent text / hint</dt>
                <dd>{step.component.hint}</dd>
              </div>
            )}
            {step.component.provenance?.exemplarId && (
              <div>
                <dt>Exemplar match</dt>
                <dd>
                  <code>{step.component.provenance.exemplarId}</code>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <footer className="builder-modal__footer">
          <button
            type="button"
            className="usa-button usa-button--outline"
            disabled={index === 0}
            onClick={() => setIndex(prev => Math.max(0, prev - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="usa-button usa-button--secondary"
            onClick={() => {
              onJumpToComponent({
                chapterId: step.chapterId,
                pageId: step.pageId,
                componentId: step.component.id,
              });
              onClose();
            }}
          >
            Edit in inspector
          </button>
          <button
            type="button"
            className="usa-button"
            onClick={() => {
              onAccept(step.component.id);
              if (index + 1 >= total) {
                onClose();
              } else {
                setIndex(prev => prev + 1);
              }
            }}
          >
            {index + 1 >= total ? 'Accept and close' : 'Accept and next'}
          </button>
        </footer>
      </div>
    </div>
  );
}
