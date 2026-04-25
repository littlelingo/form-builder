import { useRef, useState } from 'react';

import type { BuilderExample } from '../data/exampleAuthoringForm';
import { validateAuthoringForm } from '../lib/core';
import { importPdfFromFile } from '../lib/importClient';
import {
  appendCorpusEntries,
  exportCorpus,
  loadCorpus,
} from '../../../../src/import/corpus/store.mjs';
import type { AuthoringForm } from '../types';

interface FormActionsProps {
  examples: BuilderExample[];
  form: AuthoringForm;
  onImport: (form: AuthoringForm) => void;
  onLoadExample: (form: AuthoringForm) => void;
  onSetBaseline: () => void;
}

function downloadJson(form: AuthoringForm) {
  const blob = new Blob([JSON.stringify(form, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${form.formId || 'va-form'}-authoring.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCorrections() {
  const bundle = exportCorpus();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `va-form-builder-corrections.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FormActions({
  examples,
  form,
  onImport,
  onLoadExample,
  onSetBaseline,
}: FormActionsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const correctionsInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);

  async function handleImport(file?: File) {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as AuthoringForm;
      const validation = validateAuthoringForm(parsed);
      if (!validation.valid) {
        setMessage(`Import blocked: ${validation.errors.join('; ')}`);
        return;
      }
      onImport(parsed);
      setMessage(`Imported ${parsed.title || parsed.formId}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleImportCorrections(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const entries = Array.isArray(parsed?.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : null;
      if (!entries) {
        setMessage('Corrections import: expected { entries: [...] } or array.');
        return;
      }
      appendCorpusEntries(entries);
      setMessage(`Imported ${entries.length} correction exemplars. Total corpus: ${loadCorpus().length}.`);
    } catch (error) {
      setMessage(`Corrections import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (correctionsInputRef.current) correctionsInputRef.current.value = '';
    }
  }

  async function handleImportPdf(file?: File) {
    if (!file) return;
    setImporting(true);
    setMessage(`Importing ${file.name}…`);
    try {
      const result = await importPdfFromFile(file);
      const componentCount = result.form.chapters.reduce(
        (count, chapter) =>
          count +
          chapter.pages.reduce((pageCount, page) => pageCount + page.components.length, 0),
        0,
      );
      onImport(result.form);
      setMessage(
        `Imported ${file.name} → ${componentCount} components, ${result.importReport.acroFormFieldCount} AcroForm fields. Confidence varies; review badges.`,
      );
    } catch (error) {
      setMessage(`PDF import failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setImporting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="form-actions-heading">
      <div className="builder-card__header">
        <p className="builder-eyebrow">Files</p>
        <h2 id="form-actions-heading">Import and export</h2>
      </div>

      <div className="builder-example-list" aria-label="Load an example form">
        <h3>Examples</h3>
        {examples.map(example => (
          <button
            className="builder-example-button"
            key={example.id}
            type="button"
            onClick={() => {
              onLoadExample(example.form);
              setMessage(`Loaded ${example.label}.`);
            }}
          >
            <span>{example.label}</span>
            <small>{example.description}</small>
          </button>
        ))}
      </div>

      <div className="builder-action-grid">
        <button
          className="usa-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </button>
        <button
          className="usa-button"
          type="button"
          disabled={importing}
          onClick={() => pdfInputRef.current?.click()}
        >
          {importing ? 'Importing PDF…' : 'Import PDF'}
        </button>
        <button
          className="usa-button usa-button--secondary"
          type="button"
          onClick={() => downloadJson(form)}
        >
          Export JSON
        </button>
        <button
          className="usa-button usa-button--outline"
          type="button"
          onClick={onSetBaseline}
        >
          Set audit baseline
        </button>
        <button
          className="usa-button usa-button--outline"
          type="button"
          onClick={() => {
            const currentExample = examples.find(example => example.form.formId === form.formId);
            onLoadExample((currentExample || examples[0]).form);
            setMessage(`Reloaded ${(currentExample || examples[0]).label}.`);
          }}
        >
          Reload example
        </button>
        <button
          className="usa-button usa-button--outline"
          type="button"
          onClick={() => correctionsInputRef.current?.click()}
        >
          Import corrections
        </button>
        <button
          className="usa-button usa-button--outline"
          type="button"
          onClick={() => {
            downloadCorrections();
            setMessage(`Exported ${loadCorpus().length} correction exemplars.`);
          }}
        >
          Export corrections
        </button>
      </div>

      <input
        accept="application/json,.json"
        className="builder-hidden-input"
        ref={fileInputRef}
        type="file"
        onChange={event => handleImport(event.target.files?.[0])}
      />
      <input
        accept="application/pdf,.pdf"
        className="builder-hidden-input"
        ref={pdfInputRef}
        type="file"
        onChange={event => handleImportPdf(event.target.files?.[0])}
      />
      <input
        accept="application/json,.json"
        className="builder-hidden-input"
        ref={correctionsInputRef}
        type="file"
        onChange={event => handleImportCorrections(event.target.files?.[0])}
      />

      {message && <p className="builder-action-message">{message}</p>}
    </section>
  );
}
