import { useRef, useState } from 'react';

import type { AuthoringComponent, AuthoringForm, SelectedNode } from '../types';
import { confidenceBand } from '../lib/reviewState';
import {
  appendCorpusEntries,
  exportCorpus,
  loadCorpus,
} from '../../../../src/import/corpus/store.mjs';

interface ImportReviewPanelProps {
  form: AuthoringForm;
  onJump: (node: SelectedNode) => void;
  onAccept: (componentId: string) => void;
  onAcceptAll: (componentIds: string[]) => void;
}

function downloadCorrectionsBundle() {
  const bundle = exportCorpus();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'va-form-builder-corrections.json';
  anchor.click();
  URL.revokeObjectURL(url);
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
  const correctionsInputRef = useRef<HTMLInputElement | null>(null);
  const [correctionsMessage, setCorrectionsMessage] = useState<string>('');

  async function handleImportCorrections(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const entries = Array.isArray(parsed?.entries)
        ? parsed.entries
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (!entries) {
        setCorrectionsMessage('Expected { entries: [...] } or array.');
        return;
      }
      appendCorpusEntries(entries);
      setCorrectionsMessage(`Imported ${entries.length} exemplars. Total corpus: ${loadCorpus().length}.`);
    } catch (error) {
      setCorrectionsMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (correctionsInputRef.current) correctionsInputRef.current.value = '';
    }
  }

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

      <footer className="builder-review-footer">
        <p className="builder-review-footer__title">Corrections corpus</p>
        <div className="builder-review-footer__actions">
          <button
            className="usa-button usa-button--outline usa-button--small"
            type="button"
            onClick={() => correctionsInputRef.current?.click()}
          >
            Import corrections
          </button>
          <button
            className="usa-button usa-button--outline usa-button--small"
            type="button"
            onClick={() => {
              downloadCorrectionsBundle();
              setCorrectionsMessage(`Exported ${loadCorpus().length} exemplars.`);
            }}
          >
            Export corrections
          </button>
        </div>
        {correctionsMessage && (
          <p className="builder-review-footer__message" role="status">
            {correctionsMessage}
          </p>
        )}
        <input
          accept="application/json,.json"
          className="builder-hidden-input"
          ref={correctionsInputRef}
          type="file"
          onChange={event => handleImportCorrections(event.target.files?.[0])}
        />
      </footer>
    </section>
  );
}
