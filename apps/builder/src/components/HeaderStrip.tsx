import { useRef, useState } from 'react';

import { validateAuthoringForm } from '../lib/core';
import { importPdfFromFile } from '../lib/importClient';
import type { AuthoringForm, ComponentSystemId } from '../types';

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
    setBusy('Importing PDF…');
    setMessage('');
    try {
      const result = await importPdfFromFile(file);
      const componentCount = result.form.chapters.reduce(
        (count, chapter) =>
          count + chapter.pages.reduce((p, page) => p + page.components.length, 0),
        0,
      );
      onImportPdf(result.form);
      setMessage(
        `Imported ${file.name} → ${componentCount} components, ${result.importReport.acroFormFieldCount} AcroForm fields`,
      );
    } catch (error) {
      setMessage(`PDF import failed: ${error instanceof Error ? error.message : String(error)}`);
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
  );
}
