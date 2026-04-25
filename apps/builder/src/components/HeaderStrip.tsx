import { useRef, useState } from 'react';

import { validateAuthoringForm } from '../lib/core';
import { importPdfFromFile } from '../lib/importClient';
import type { ImportPdfResult, ImportProgressEvent, ImportProgressStage } from '../lib/importClient';
import type { AuthoringForm, ComponentSystemId } from '../types';

const importSteps: Array<{ stage: ImportProgressStage; label: string }> = [
  { stage: 'file-read', label: 'Read file' },
  { stage: 'fingerprint', label: 'Fingerprint' },
  { stage: 'extract-acroform', label: 'Fields' },
  { stage: 'extract-text', label: 'Page text' },
  { stage: 'pair-labels', label: 'Labels' },
  { stage: 'corpus', label: 'Corpus' },
  { stage: 'enrichment', label: 'Enrichment' },
  { stage: 'build-authoring', label: 'Build JSON' },
  { stage: 'validate', label: 'Validate' },
  { stage: 'complete', label: 'Load canvas' },
];

interface PdfImportStatus {
  phase: 'running' | 'success' | 'blocked' | 'error';
  fileName: string;
  activeStage: ImportProgressStage;
  detail: string;
  startedAt: number;
  elapsedMs?: number;
  error?: string;
  report?: ImportPdfResult['importReport'];
  stats: {
    byteLength?: number;
    pageCount?: number;
    pageNumber?: number;
    fieldCount?: number;
    pairedFieldCount?: number;
    corpusEntryCount?: number;
    corpusHits?: number;
    enrichment?: string;
    chapterCount?: number;
    componentCount?: number;
  };
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 1000) return '<1s';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatBytes(bytes?: number): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeImportStats(
  current: PdfImportStatus['stats'],
  event: ImportProgressEvent,
): PdfImportStatus['stats'] {
  return {
    ...current,
    ...(event.byteLength !== undefined ? { byteLength: event.byteLength } : {}),
    ...(event.pageCount !== undefined ? { pageCount: event.pageCount } : {}),
    ...(event.pageNumber !== undefined ? { pageNumber: event.pageNumber } : {}),
    ...(event.fieldCount !== undefined ? { fieldCount: event.fieldCount } : {}),
    ...(event.pairedFieldCount !== undefined ? { pairedFieldCount: event.pairedFieldCount } : {}),
    ...(event.corpusEntryCount !== undefined ? { corpusEntryCount: event.corpusEntryCount } : {}),
    ...(event.corpusHits !== undefined ? { corpusHits: event.corpusHits } : {}),
    ...(event.enrichment !== undefined ? { enrichment: event.enrichment } : {}),
    ...(event.chapterCount !== undefined ? { chapterCount: event.chapterCount } : {}),
    ...(event.componentCount !== undefined ? { componentCount: event.componentCount } : {}),
  };
}

function componentCount(form: AuthoringForm): number {
  return form.chapters.reduce(
    (count, chapter) =>
      count + chapter.pages.reduce((pageCount, page) => pageCount + page.components.length, 0),
    0,
  );
}

function ImportProgressPanel({
  status,
  onDismiss,
}: {
  status: PdfImportStatus;
  onDismiss: () => void;
}) {
  const activeIndex = Math.max(
    0,
    importSteps.findIndex(step => step.stage === status.activeStage),
  );
  const percent = Math.round(((activeIndex + 1) / importSteps.length) * 100);
  const fileSize = formatBytes(status.stats.byteLength);
  const elapsed = formatDuration(status.elapsedMs ?? Date.now() - status.startedAt);
  const validationErrors = status.report?.validation.errors.length || 0;
  const componentTotal = status.stats.componentCount ?? status.report?.componentCount;

  return (
    <section
      className={`pdf-import-progress pdf-import-progress--${status.phase}`}
      aria-labelledby="pdf-import-progress-heading"
      aria-live={status.phase === 'error' ? 'assertive' : 'polite'}
      aria-busy={status.phase === 'running'}
    >
      <div className="pdf-import-progress__panel">
        <header className="pdf-import-progress__header">
          <div>
            <p className="builder-eyebrow">PDF import</p>
            <h2 id="pdf-import-progress-heading">
              {status.phase === 'running'
                ? 'Converting PDF into a builder form'
                : status.phase === 'success'
                  ? 'PDF import loaded into the canvas'
                  : status.phase === 'blocked'
                    ? 'PDF import did not find builder fields'
                    : 'PDF import needs attention'}
            </h2>
            <p>
              <strong>{status.fileName}</strong>
              {fileSize ? ` | ${fileSize}` : ''} | elapsed {elapsed}
            </p>
          </div>
          {status.phase !== 'running' && (
            <button
              className="pdf-import-progress__dismiss"
              type="button"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
        </header>

        <div className="pdf-import-progress__meter" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>

        <p className="pdf-import-progress__detail">
          {status.error || status.detail}
        </p>

        <ol className="pdf-import-progress__steps" aria-label="Import progress steps">
          {importSteps.map((step, index) => {
            const state =
              status.phase === 'error' && index === activeIndex
                ? 'error'
                : status.phase === 'blocked' && step.stage === 'complete'
                  ? 'blocked'
                  : index < activeIndex || status.phase === 'success'
                  ? 'done'
                  : index === activeIndex
                    ? 'active'
                    : 'pending';
            return (
              <li className={`is-${state}`} key={step.stage}>
                <span aria-hidden="true" />
                {step.label}
              </li>
            );
          })}
        </ol>

        <dl className="pdf-import-progress__stats">
          <div>
            <dt>Pages</dt>
            <dd>
              {status.stats.pageNumber && status.stats.pageCount
                ? `${status.stats.pageNumber}/${status.stats.pageCount}`
                : status.stats.pageCount ?? '-'}
            </dd>
          </div>
          <div>
            <dt>Readable fields</dt>
            <dd>{status.stats.fieldCount ?? '-'}</dd>
          </div>
          <div>
            <dt>Builder components</dt>
            <dd>{componentTotal ?? '-'}</dd>
          </div>
          <div>
            <dt>Paired labels</dt>
            <dd>{status.stats.pairedFieldCount ?? '-'}</dd>
          </div>
          <div>
            <dt>Corpus hits</dt>
            <dd>
              {status.stats.corpusHits ?? '-'}
              {status.stats.corpusEntryCount ? ` / ${status.stats.corpusEntryCount}` : ''}
            </dd>
          </div>
          <div>
            <dt>Enrichment</dt>
            <dd>{status.stats.enrichment || status.report?.enrichment?.reason || 'pending'}</dd>
          </div>
          <div>
            <dt>Validation</dt>
            <dd>
              {status.report
                ? status.report.validation.valid
                  ? 'valid'
                  : `${validationErrors} issue${validationErrors === 1 ? '' : 's'}`
                : 'pending'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

interface HeaderStripProps {
  form: AuthoringForm;
  dirty: boolean;
  onNew: () => void;
  onOpen: (form: AuthoringForm) => void;
  onSave: () => void;
  onImportPdf: (form: AuthoringForm) => void;
  onExportJson: () => void;

  canvasMode: 'edit' | 'preview';
  activePanel: 'preview' | 'runner' | 'output';
  canUndo: boolean;
  canRedo: boolean;
  previewSystem: ComponentSystemId;
  onCanvasModeChange: (mode: 'edit' | 'preview') => void;
  onPanelChange: (panel: 'preview' | 'runner' | 'output') => void;
  onPreviewSystemChange: (system: ComponentSystemId) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function HeaderStrip(props: HeaderStripProps) {
  const {
    form,
    dirty,
    onNew,
    onOpen,
    onSave,
    onImportPdf,
    onExportJson,
    canvasMode,
    activePanel,
    canUndo,
    canRedo,
    previewSystem,
    onCanvasModeChange,
    onPanelChange,
    onPreviewSystemChange,
    onUndo,
    onRedo,
  } = props;

  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [pdfImportStatus, setPdfImportStatus] = useState<PdfImportStatus | null>(null);
  const [overflowOpen, setOverflowOpen] = useState<boolean>(false);

  async function handleOpen(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AuthoringForm;
      const validation = validateAuthoringForm(parsed);
      if (!validation.valid) {
        setMessage(`Open blocked: ${validation.errors.join('; ')}`);
        return;
      }
      onOpen(parsed);
      setMessage(`Opened ${parsed.title || parsed.formId}`);
    } catch (error) {
      setMessage(`Open failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  }

  async function handleImportPdf(file?: File) {
    if (!file) return;
    setBusy('Importing PDF...');
    setMessage('');
    setPdfImportStatus({
      phase: 'running',
      fileName: file.name,
      activeStage: 'file-read',
      detail: 'Reading the selected PDF and preparing the importer.',
      startedAt: Date.now(),
      stats: { byteLength: file.size },
    });
    try {
      const result = await importPdfFromFile(file, {
        onProgress: event => {
          setPdfImportStatus(current => ({
            phase: 'running',
            fileName: current?.fileName || file.name,
            activeStage: event.stage,
            detail: event.detail,
            startedAt: current?.startedAt || Date.now(),
            elapsedMs: event.elapsedMs,
            stats: mergeImportStats(current?.stats || { byteLength: file.size }, event),
          }));
        },
      });
      const importedComponentCount = componentCount(result.form);
      const canLoadImport =
        result.importReport.validation.valid && importedComponentCount > 0;
      if (!canLoadImport) {
        const validationSummary = result.importReport.validation.errors.length
          ? ` Validation: ${result.importReport.validation.errors.join('; ')}`
          : '';
        setPdfImportStatus(current => ({
          phase: 'blocked',
          fileName: current?.fileName || file.name,
          activeStage: 'complete',
          detail:
            importedComponentCount === 0
              ? `The PDF was readable as static page text, but it did not expose any fillable AcroForm fields for the current importer to convert. Nothing was loaded into the builder.${validationSummary}`
              : `The importer produced ${importedComponentCount} components, but the generated authoring JSON did not pass validation. Nothing was loaded into the builder.${validationSummary}`,
          startedAt: current?.startedAt || Date.now(),
          elapsedMs: result.importReport.durationMs,
          report: result.importReport,
          stats: {
            ...(current?.stats || { byteLength: file.size }),
            pageCount: result.importReport.pageCount,
            fieldCount: result.importReport.acroFormFieldCount,
            componentCount: importedComponentCount,
            corpusEntryCount: result.importReport.corpusEntryCount,
            corpusHits: result.importReport.corpusHits,
            enrichment: result.importReport.enrichment?.reason,
            chapterCount: result.form.chapters.length,
          },
        }));
        setMessage(
          `PDF import needs review: ${file.name} produced ${importedComponentCount} builder components`,
        );
        return;
      }
      onImportPdf(result.form);
      setPdfImportStatus(current => ({
        phase: 'success',
        fileName: current?.fileName || file.name,
        activeStage: 'complete',
        detail: `Loaded ${importedComponentCount} components into the canvas. Review imported confidence in the right panel.`,
        startedAt: current?.startedAt || Date.now(),
        elapsedMs: result.importReport.durationMs,
        report: result.importReport,
        stats: {
          ...(current?.stats || { byteLength: file.size }),
          pageCount: result.importReport.pageCount,
          fieldCount: result.importReport.acroFormFieldCount,
          componentCount: importedComponentCount,
          corpusEntryCount: result.importReport.corpusEntryCount,
          corpusHits: result.importReport.corpusHits,
          enrichment: result.importReport.enrichment?.reason,
          chapterCount: result.form.chapters.length,
        },
      }));
      setMessage(
        `Imported ${file.name}: ${importedComponentCount} components, ${result.importReport.acroFormFieldCount} AcroForm fields`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setPdfImportStatus(current => ({
        phase: 'error',
        fileName: current?.fileName || file.name,
        activeStage: current?.activeStage || 'file-read',
        detail: current?.detail || 'The PDF importer stopped before the form could be loaded.',
        startedAt: current?.startedAt || Date.now(),
        elapsedMs: current ? Date.now() - current.startedAt : undefined,
        error: errorMessage,
        stats: current?.stats || { byteLength: file.size },
      }));
      setMessage(`PDF import failed: ${errorMessage}`);
    } finally {
      setBusy(null);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  function handleNew() {
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes and start a new form?');
      if (!ok) return;
    }
    onNew();
    setMessage('Started new form');
  }

  return (
    <>
      <div className="builder-header-strip" role="toolbar" aria-label="Form actions">
        <div className="builder-header-strip__group" aria-label="File actions">
          <button
            className="builder-header-strip__action"
            type="button"
            onClick={handleNew}
            title="Start a new blank form"
          >
            <span aria-hidden="true">＋</span>
            <span>New</span>
          </button>
          <button
            className="builder-header-strip__action"
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            title="Open an existing authoring JSON"
          >
            <span aria-hidden="true">📂</span>
            <span>Open JSON</span>
          </button>
          <button
            className={`builder-header-strip__action builder-header-strip__action--save${dirty ? ' is-dirty' : ''}`}
            type="button"
            disabled={!dirty}
            onClick={() => {
              onSave();
              setMessage(`Saved ${form.formId || 'form'}`);
            }}
            title={dirty ? 'Download JSON and snapshot to local storage' : 'No unsaved changes'}
          >
            <span aria-hidden="true">{dirty ? '●' : '✓'}</span>
            <span>{dirty ? 'Save *' : 'Saved'}</span>
          </button>
          <button
            className="builder-header-strip__action builder-header-strip__action--import"
            type="button"
            disabled={busy !== null}
            onClick={() => pdfInputRef.current?.click()}
            title="Import an AcroForm PDF and convert to authoring JSON"
          >
            <span aria-hidden="true">📄</span>
            <span>{busy || 'Import PDF'}</span>
          </button>
        </div>

      <div className="builder-header-strip__spacer" aria-hidden="true" />

      <div className="builder-header-strip__group" aria-label="History">
        <button
          className="builder-header-strip__action"
          type="button"
          disabled={!canUndo}
          title="Undo"
          onClick={onUndo}
        >
          <span aria-hidden="true">↶</span>
          <span>Undo</span>
        </button>
        <button
          className="builder-header-strip__action"
          type="button"
          disabled={!canRedo}
          title="Redo"
          onClick={onRedo}
        >
          <span aria-hidden="true">↷</span>
          <span>Redo</span>
        </button>
      </div>

      <div className="builder-header-strip__group" role="radiogroup" aria-label="Canvas mode">
        <button
          className={`builder-header-strip__action${canvasMode === 'edit' ? ' is-active' : ''}`}
          type="button"
          role="radio"
          aria-checked={canvasMode === 'edit'}
          onClick={() => onCanvasModeChange('edit')}
        >
          <span aria-hidden="true">✎</span>
          <span>Edit</span>
        </button>
        <button
          className={`builder-header-strip__action${canvasMode === 'preview' ? ' is-active' : ''}`}
          type="button"
          role="radio"
          aria-checked={canvasMode === 'preview'}
          onClick={() => onCanvasModeChange('preview')}
        >
          <span aria-hidden="true">👁</span>
          <span>Preview</span>
        </button>
      </div>

      <div className="builder-header-strip__group" role="tablist" aria-label="Workspace panel">
        <button
          className={`builder-header-strip__action${activePanel === 'preview' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activePanel === 'preview'}
          onClick={() => onPanelChange('preview')}
        >
          Canvas
        </button>
        <button
          className={`builder-header-strip__action${activePanel === 'runner' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activePanel === 'runner'}
          onClick={() => onPanelChange('runner')}
        >
          Run
        </button>
        <button
          className={`builder-header-strip__action${activePanel === 'output' ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activePanel === 'output'}
          onClick={() => onPanelChange('output')}
        >
          Code
        </button>
      </div>

      <label className="builder-header-strip__select" htmlFor="header-preview-system">
        <span>Preview</span>
        <select
          className="usa-select"
          id="header-preview-system"
          value={previewSystem}
          onChange={event => onPreviewSystemChange(event.target.value as ComponentSystemId)}
        >
          <option value="uswds">USWDS</option>
          <option value="shadcn">shadcn/ui</option>
        </select>
      </label>

      <div className="builder-header-strip__secondary">
        <button
          className="builder-header-strip__overflow"
          type="button"
          aria-expanded={overflowOpen}
          aria-haspopup="menu"
          onClick={() => setOverflowOpen(prev => !prev)}
          title="More actions"
        >
          More ▾
        </button>
        {overflowOpen && (
          <div className="builder-header-strip__menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onExportJson();
                setOverflowOpen(false);
                setMessage(`Exported ${form.formId || 'form'}`);
              }}
            >
              Export JSON
            </button>
          </div>
        )}
      </div>

      {message && <p className="builder-header-strip__message" role="status">{message}</p>}

      <input
        accept="application/json,.json"
        className="builder-hidden-input"
        ref={jsonInputRef}
        type="file"
        onChange={event => handleOpen(event.target.files?.[0])}
      />
      <input
        accept="application/pdf,.pdf"
        className="builder-hidden-input"
        ref={pdfInputRef}
        type="file"
        onChange={event => handleImportPdf(event.target.files?.[0])}
      />
      </div>
      {pdfImportStatus && (
        <ImportProgressPanel
          status={pdfImportStatus}
          onDismiss={() => setPdfImportStatus(null)}
        />
      )}
    </>
  );
}
