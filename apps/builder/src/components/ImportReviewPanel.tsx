import { useRef, useState } from 'react';

import type { AuthoringComponent, AuthoringForm, SelectedNode } from '../types';
import { buildConfidenceInsight } from '../lib/confidenceInsights';
import { confidenceBand, needsHumanReview } from '../lib/reviewState';
import {
  appendCorpusEntries,
  exportCorpus,
  loadCorpus,
} from '../../../../src/import/corpus/store.mjs';
import {
  appendRecipe,
  appendRecipes,
  loadRecipeCatalog,
} from '../../../../src/import/curation/recipes.mjs';
import {
  createRecipeCatalogFromAuthoringForm as buildRecipeCatalogFromAuthoringForm,
  createRecipeFromAuthoringForm as buildRecipeFromAuthoringForm,
} from '../../../../src/import/curation/fromAuthoring.mjs';

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

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadRecipeCatalog(form: AuthoringForm) {
  const bundle = buildRecipeCatalogFromAuthoringForm(form);
  downloadJson(`${form.formId || 'imported-form'}-curation-recipe.json`, bundle);
  return bundle;
}

interface ReviewRow {
  component: AuthoringComponent;
  chapterId: string;
  pageId: string;
}

interface CurationDecisionRow {
  chapterId: string;
  chapterTitle: string;
  pageId: string;
  pageTitle: string;
  arrayPath?: string;
  source: string;
  itemFieldCount: number;
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
        if (needsHumanReview(component)) {
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

function gatherCurationDecisions(form: AuthoringForm): CurationDecisionRow[] {
  const decisions = new Map<string, CurationDecisionRow>();
  for (const chapter of form.chapters) {
    if (chapter.type !== 'listLoop') continue;
    for (const page of chapter.pages) {
      const curatedComponents = flatten(page.components).filter(
        component => component.provenance?.curation?.source,
      );
      if (curatedComponents.length === 0) continue;
      const firstCuration = curatedComponents[0].provenance?.curation;
      const key = `${chapter.id}:${page.id}`;
      decisions.set(key, {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        pageId: page.id,
        pageTitle: page.title,
        arrayPath: typeof chapter.options?.arrayPath === 'string'
          ? chapter.options.arrayPath
          : undefined,
        source: firstCuration?.source || 'curation',
        itemFieldCount: curatedComponents.length,
      });
    }
  }
  return [...decisions.values()];
}

function bandLabel(band: 'high' | 'medium' | 'low'): string {
  if (band === 'high') return 'High';
  if (band === 'medium') return 'Medium';
  return 'Low';
}

export function ImportReviewPanel({ form, onJump, onAccept, onAcceptAll }: ImportReviewPanelProps) {
  const rows = gatherUnreviewed(form);
  const curationDecisions = gatherCurationDecisions(form);
  const correctionsInputRef = useRef<HTMLInputElement | null>(null);
  const recipesInputRef = useRef<HTMLInputElement | null>(null);
  const [correctionsMessage, setCorrectionsMessage] = useState<string>('');
  const [recipeMessage, setRecipeMessage] = useState<string>('');

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

  async function handleImportRecipes(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const recipes = Array.isArray(parsed?.recipes)
        ? parsed.recipes
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (!recipes) {
        setRecipeMessage('Expected { recipes: [...] } or array.');
        return;
      }
      appendRecipes(recipes);
      setRecipeMessage(`Imported ${recipes.length} recipes. Total recipes: ${loadRecipeCatalog().recipes.length}.`);
    } catch (error) {
      setRecipeMessage(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (recipesInputRef.current) recipesInputRef.current.value = '';
    }
  }

  function handlePromoteRecipe() {
    try {
      const recipe = buildRecipeFromAuthoringForm(form);
      appendRecipe(recipe);
      setRecipeMessage(`Promoted ${recipe.fields.length} reviewed fields into recipe ${recipe.id}.`);
    } catch (error) {
      setRecipeMessage(`Promotion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleExportRecipe() {
    try {
      const bundle = downloadRecipeCatalog(form);
      setRecipeMessage(`Exported ${bundle.recipes[0]?.fields?.length || 0} reviewed fields as a recipe.`);
    } catch (error) {
      setRecipeMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
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
            const insight = buildConfidenceInsight(row.component.provenance);
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
                    <span>PDF field:</span> <code>{row.component.provenance.pdfFieldName}</code>
                    {typeof row.component.provenance.pdfPage === 'number' && (
                      <span> • page {row.component.provenance.pdfPage + 1}</span>
                    )}
                  </p>
                )}
                {band === 'low' && (
                  <p className="builder-review-row__reason">{insight.summary}</p>
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

      {curationDecisions.length > 0 && (
        <section className="builder-curation-summary" aria-labelledby="review-curation-heading">
          <p className="builder-eyebrow">Curation decisions</p>
          <h3 id="review-curation-heading">Applied during PDF conversion</h3>
          <ul>
            {curationDecisions.map(decision => (
              <li key={`${decision.chapterId}:${decision.pageId}`}>
                <strong>{decision.chapterTitle}</strong>
                <span>
                  Converted by {decision.source} into a list loop with {decision.itemFieldCount}{' '}
                  field{decision.itemFieldCount === 1 ? '' : 's'}
                  {decision.arrayPath ? ` at ${decision.arrayPath}` : ''}.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="builder-review-footer">
        <div className="builder-review-footer__group">
          <p className="builder-review-footer__title">Curation recipes</p>
          <div className="builder-review-footer__actions">
            <button
              className="usa-button usa-button--outline usa-button--small"
              type="button"
              onClick={() => recipesInputRef.current?.click()}
            >
              Import recipes
            </button>
            <button
              className="usa-button usa-button--outline usa-button--small"
              type="button"
              onClick={handlePromoteRecipe}
            >
              Promote recipe
            </button>
            <button
              className="usa-button usa-button--outline usa-button--small"
              type="button"
              onClick={handleExportRecipe}
            >
              Export recipe
            </button>
          </div>
          {recipeMessage && (
            <p className="builder-review-footer__message" role="status">
              {recipeMessage}
            </p>
          )}
          <input
            accept="application/json,.json"
            className="builder-hidden-input"
            ref={recipesInputRef}
            type="file"
            onChange={event => handleImportRecipes(event.target.files?.[0])}
          />
        </div>

        <div className="builder-review-footer__group">
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
        </div>
      </footer>
    </section>
  );
}
