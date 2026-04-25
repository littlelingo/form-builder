import type { ComponentSystemId } from '../types';

interface BuilderToolbarProps {
  activePanel: 'preview' | 'runner' | 'output';
  canvasMode: 'edit' | 'preview';
  previewSystem: ComponentSystemId;
  canRedo: boolean;
  canUndo: boolean;
  onCanvasModeChange: (mode: 'edit' | 'preview') => void;
  onRedo: () => void;
  onPanelChange: (panel: 'preview' | 'runner' | 'output') => void;
  onPreviewSystemChange: (system: ComponentSystemId) => void;
  onUndo: () => void;
}

export function BuilderToolbar({
  activePanel,
  canvasMode,
  previewSystem,
  canRedo,
  canUndo,
  onCanvasModeChange,
  onRedo,
  onPanelChange,
  onPreviewSystemChange,
  onUndo,
}: BuilderToolbarProps) {
  return (
    <div className="builder-toolbar builder-toolbar--floating" aria-label="Canvas toolbar">
      <div className="builder-toolbar__group" aria-label="History">
        <button
          className="builder-toolbar__icon-button"
          disabled={!canUndo}
          title="Undo"
          type="button"
          onClick={onUndo}
        >
          Undo
        </button>
        <button
          className="builder-toolbar__icon-button"
          disabled={!canRedo}
          title="Redo"
          type="button"
          onClick={onRedo}
        >
          Redo
        </button>
      </div>

      <div className="builder-toolbar__group" aria-label="Workspace view">
        <div className="builder-segmented" role="radiogroup" aria-label="Canvas mode">
          <button
            aria-checked={canvasMode === 'edit'}
            className={canvasMode === 'edit' ? 'is-active' : ''}
            role="radio"
            type="button"
            onClick={() => onCanvasModeChange('edit')}
          >
            Edit
          </button>
          <button
            aria-checked={canvasMode === 'preview'}
            className={canvasMode === 'preview' ? 'is-active' : ''}
            role="radio"
            type="button"
            onClick={() => onCanvasModeChange('preview')}
          >
            Preview
          </button>
        </div>

        <div className="builder-segmented" role="tablist" aria-label="Workspace panels">
          <button
            aria-selected={activePanel === 'preview'}
            className={activePanel === 'preview' ? 'is-active' : ''}
            role="tab"
            type="button"
            onClick={() => onPanelChange('preview')}
          >
            Canvas
          </button>
          <button
            aria-selected={activePanel === 'runner'}
            className={activePanel === 'runner' ? 'is-active' : ''}
            role="tab"
            type="button"
            onClick={() => onPanelChange('runner')}
          >
            Run
          </button>
          <button
            aria-selected={activePanel === 'output'}
            className={activePanel === 'output' ? 'is-active' : ''}
            role="tab"
            type="button"
            onClick={() => onPanelChange('output')}
          >
            Code
          </button>
        </div>

        <label className="builder-toolbar__select" htmlFor="toolbar-preview-system">
          <span>Preview</span>
          <select
            className="usa-select"
            id="toolbar-preview-system"
            value={previewSystem}
            onChange={event => onPreviewSystemChange(event.target.value as ComponentSystemId)}
          >
            <option value="uswds">USWDS</option>
            <option value="shadcn">shadcn/ui</option>
          </select>
        </label>
      </div>
    </div>
  );
}
