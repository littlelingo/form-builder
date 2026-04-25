import type { AuthoringComponent, AuthoringForm, SelectedNode } from '../types';
import { confidenceBand } from '../lib/reviewState';

interface ImportReviewPanelProps {
  form: AuthoringForm;
  onJump: (node: SelectedNode) => void;
  onAccept: (componentId: string) => void;
  onAcceptAll: (componentIds: string[]) => void;
}

interface ReviewRow {
  component: AuthoringComponent;
  chapterId: string;
  pageId: string;
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

function gatherUnreviewed(form: AuthoringForm): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const chapter of form.chapters) {
    for (const page of chapter.pages) {
      for (const component of flatten(page.components)) {
        if (component.provenance && component.provenance.reviewed === false) {
          rows.push({ component, chapterId: chapter.id, pageId: page.id });
        }
      }
    }
  }
  rows.sort((a, b) => {
    const ac = a.component.provenance?.confidence ?? 0;
    const bc = b.component.provenance?.confidence ?? 0;
    return ac - bc;
  });
  return rows;
}

function bandLabel(band: 'high' | 'medium' | 'low'): string {
  if (band === 'high') return 'High';
  if (band === 'medium') return 'Medium';
  return 'Low';
}

export function ImportReviewPanel({ form, onJump, onAccept, onAcceptAll }: ImportReviewPanelProps) {
  const rows = gatherUnreviewed(form);

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="review-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Review</p>
          <h2 id="review-heading">Imported components ({rows.length})</h2>
        </div>
        {rows.length > 0 && (
          <button
            className="usa-button usa-button--secondary"
            type="button"
            onClick={() => onAcceptAll(rows.map(r => r.component.id))}
          >
            Accept all
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="usa-prose">All imported components reviewed.</p>
      ) : (
        <ol className="builder-review-list">
          {rows.map(row => {
            const confidence = row.component.provenance?.confidence ?? 0;
            const band = confidenceBand(confidence);
            const percent = Math.round(confidence * 100);
            return (
              <li key={row.component.id} className={`builder-review-row builder-review-row--${band}`}>
                <div className="builder-review-row__header">
                  <span className={`confidence-badge confidence-badge--${band} confidence-badge--compact`}>
                    <span className="confidence-badge__chip">
                      <span className="confidence-badge__dot" aria-hidden="true" />
                      {bandLabel(band)} • {percent}%
                    </span>
                  </span>
                  <strong>{row.component.label}</strong>
                  <small>
                    <code>{row.component.type}</code>
                  </small>
                </div>
                {row.component.provenance?.pdfFieldName && (
                  <p className="builder-review-row__meta">
                    <span>AcroForm:</span> <code>{row.component.provenance.pdfFieldName}</code>
                    {typeof row.component.provenance.pdfPage === 'number' && (
                      <span> • page {row.component.provenance.pdfPage + 1}</span>
                    )}
                  </p>
                )}
                <div className="builder-review-row__actions">
                  <button
                    className="usa-button usa-button--small"
                    type="button"
                    onClick={() => onAccept(row.component.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="usa-button usa-button--secondary usa-button--small"
                    type="button"
                    onClick={() =>
                      onJump({
                        chapterId: row.chapterId,
                        pageId: row.pageId,
                        componentId: row.component.id,
                      })
                    }
                  >
                    Edit
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
