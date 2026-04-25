import { useRef, useState } from 'react';

import { paletteCategories, paletteComponents, sectionTemplates } from '../lib/formModel';
import type {
  ScreenTemplateId,
  SectionTemplateId,
  TemplateInsertionOptions,
} from '../lib/formModel';
import type { PaletteDragItem, SavedCustomTemplate } from '../types';

type BuildTab = 'fields' | 'patterns';

interface ToolTileProps {
  disabled?: boolean;
  draggable?: boolean;
  icon: string;
  label: string;
  title: string;
  wide?: boolean;
  onClick: () => void;
  onDragEnd: () => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
}

interface BuildToolboxProps {
  disabled?: boolean;
  onAddField: (type: string) => void;
  onAddCustomTemplate: (templateId: string) => void;
  onAddScreen: (templateId: ScreenTemplateId, options?: TemplateInsertionOptions) => void;
  onAddSection: (templateId: SectionTemplateId, options?: TemplateInsertionOptions) => void;
  onExportCustomTemplates: () => void;
  onImportCustomTemplates: (templates: SavedCustomTemplate[]) => number;
  onRemoveCustomTemplate: (templateId: string) => void;
  onSaveCustomTemplate: (label: string) => void;
  onPaletteDragEnd: () => void;
  onPaletteDragStart: (item: PaletteDragItem) => void;
  customTemplates: SavedCustomTemplate[];
  canSaveCustomTemplate?: boolean;
  saveCustomTemplateDefaultName?: string;
  saveCustomTemplateLabel?: string;
}

const fieldIcons: Record<string, string> = {
  address: '@',
  checkbox: '[x]',
  date: 'cal',
  email: '@',
  fileUpload: 'up',
  phone: 'tel',
  radioButton: 'o',
  select: 'v',
  textArea: 'Tt',
  textInput: 'T',
  yesNo: 'Y/N',
  alert: '!',
  accordion: 'acc',
  button: 'btn',
  buttonGroup: 'btns',
  card: 'card',
  characterCount: '#',
  comboBox: 'cmb',
  dateRange: 'rng',
  inputGroup: '+',
  maskedInput: '###',
  memorableDate: 'md',
  processList: '1.',
  prose: 'txt',
  rangeSlider: '<>',
  search: 'srch',
  summaryBox: 'sum',
  switch: 'on',
  table: 'tbl',
  tag: 'tag',
  timePicker: 'time',
};

const advancedTemplateIds = new Set<SectionTemplateId>([
  'repeatable',
  'employmentLoop',
  'dependentLoop',
]);

export function BuildToolbox({
  disabled = false,
  onAddField,
  onAddCustomTemplate,
  onAddScreen,
  onAddSection,
  onExportCustomTemplates,
  onImportCustomTemplates,
  onRemoveCustomTemplate,
  onSaveCustomTemplate,
  onPaletteDragEnd,
  onPaletteDragStart,
  customTemplates,
  canSaveCustomTemplate = false,
  saveCustomTemplateDefaultName = 'Saved template',
  saveCustomTemplateLabel = 'Save current screen',
}: BuildToolboxProps) {
  const customTemplateInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<BuildTab>('fields');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [includeTemplateHelpers, setIncludeTemplateHelpers] = useState(true);
  const [templateTransferMessage, setTemplateTransferMessage] = useState('');
  const screenSectionTemplates = sectionTemplates.filter(
    template => !advancedTemplateIds.has(template.id) && template.id !== 'standard',
  );
  const advancedTemplates = sectionTemplates.filter(template => advancedTemplateIds.has(template.id));
  const componentsByCategory = paletteCategories
    .map(category => ({
      ...category,
      components: paletteComponents.filter(component => component.category === category.id),
    }))
    .filter(category => category.components.length > 0);

  function handleFieldDragStart(event: React.DragEvent<HTMLDivElement>, type: string) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-va-component-type', type);
    event.dataTransfer.setData('text/plain', `component:${type}`);
    onPaletteDragStart({ kind: 'component', type });
  }

  function handleTemplateDragStart(
    event: React.DragEvent<HTMLDivElement>,
    templateId: string,
  ) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-va-section-template', templateId);
    event.dataTransfer.setData(
      'application/x-va-template-helpers',
      includeTemplateHelpers ? 'include' : 'skip',
    );
    event.dataTransfer.setData('text/plain', `section:${templateId}`);
    onPaletteDragStart({
      kind: 'section',
      templateId,
      includeAuthoringHelpers: includeTemplateHelpers,
    });
  }

  function handleCustomTemplateDragStart(
    event: React.DragEvent<HTMLDivElement>,
    templateId: string,
  ) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-va-custom-template', templateId);
    event.dataTransfer.setData('text/plain', `custom-template:${templateId}`);
    onPaletteDragStart({ kind: 'customTemplate', templateId });
  }

  async function handleCustomTemplateImport(file?: File) {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const importedCount = onImportCustomTemplates(
        Array.isArray(parsed) ? parsed : parsed.templates,
      );
      setTemplateTransferMessage(
        importedCount === 1
          ? 'Imported 1 saved template.'
          : `Imported ${importedCount} saved templates.`,
      );
    } catch (error) {
      setTemplateTransferMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (customTemplateInputRef.current) customTemplateInputRef.current.value = '';
    }
  }

  return (
    <section className="builder-toolbox" aria-labelledby="build-toolbox-heading">
      <div className="builder-toolbox__header">
        <div>
          <p className="builder-eyebrow">Build</p>
          <h2 id="build-toolbox-heading">Add to canvas</h2>
        </div>
      </div>

      <div className="builder-toolbox__tabs" role="tablist" aria-label="Build tools">
        <button
          aria-selected={activeTab === 'fields'}
          className={activeTab === 'fields' ? 'is-active' : ''}
          role="tab"
          type="button"
          onClick={() => setActiveTab('fields')}
        >
          Fields
        </button>
        <button
          aria-selected={activeTab === 'patterns'}
          className={activeTab === 'patterns' ? 'is-active' : ''}
          role="tab"
          type="button"
          onClick={() => setActiveTab('patterns')}
        >
          Patterns
        </button>
      </div>

      {activeTab === 'fields' && (
        <div className="builder-component-stack">
          {componentsByCategory.map(category => (
            <div className="builder-component-group" key={category.id}>
              <h3>{category.label}</h3>
              <div className="builder-tool-grid builder-tool-grid--fields">
                {category.components.map(component => (
                  <ToolTile
                    disabled={disabled || component.status === 'planned'}
                    icon={fieldIcons[component.type] || '+'}
                    key={component.type}
                    label={component.label}
                    title={component.description}
                    onClick={() => {
                      if (!disabled && component.status !== 'planned') onAddField(component.type);
                    }}
                    onDragEnd={onPaletteDragEnd}
                    onDragStart={event => handleFieldDragStart(event, component.type)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="builder-template-stack">
          <button
            className="builder-add-screen-button"
            disabled={disabled}
            type="button"
            onClick={() => {
              if (!disabled) onAddScreen('blank', {
                includeAuthoringHelpers: includeTemplateHelpers,
              });
            }}
          >
            + Blank screen
          </button>

          <div className="builder-template-helper-control">
            <div className="usa-checkbox">
              <input
                aria-describedby="template-helper-presets-hint"
                checked={includeTemplateHelpers}
                className="usa-checkbox__input"
                disabled={disabled}
                id="template-helper-presets"
                type="checkbox"
                onChange={event => setIncludeTemplateHelpers(event.target.checked)}
              />
              <label className="usa-checkbox__label" htmlFor="template-helper-presets">
                Include helper presets
              </label>
            </div>
            <p id="template-helper-presets-hint">
              Applies template prefill mappings and computed summaries when available.
            </p>
          </div>

          <div className="builder-save-template-control">
            <label htmlFor="custom-template-name">Template name</label>
            <input
              id="custom-template-name"
              placeholder={saveCustomTemplateDefaultName}
              type="text"
              value={customTemplateName}
              onChange={event => setCustomTemplateName(event.target.value)}
            />
            <button
              className="builder-add-screen-button builder-add-screen-button--secondary"
              disabled={disabled || !canSaveCustomTemplate}
              type="button"
              onClick={() => {
                if (disabled || !canSaveCustomTemplate) return;
                onSaveCustomTemplate(customTemplateName.trim() || saveCustomTemplateDefaultName);
                setCustomTemplateName('');
              }}
            >
              {saveCustomTemplateLabel}
            </button>
          </div>

          {customTemplates.length > 0 && (
            <div>
              <h3>Saved templates</h3>
              <div className="builder-template-transfer-actions">
                <button
                  className="usa-button usa-button--secondary"
                  disabled={disabled}
                  type="button"
                  onClick={onExportCustomTemplates}
                >
                  Export
                </button>
                <button
                  className="usa-button usa-button--outline"
                  disabled={disabled}
                  type="button"
                  onClick={() => customTemplateInputRef.current?.click()}
                >
                  Import
                </button>
              </div>
              <div className="builder-custom-template-list">
                {customTemplates.map(template => (
                  <div className="builder-custom-template-row" key={template.id}>
                    <ToolTile
                      disabled={disabled}
                      icon={template.kind === 'screen' ? 'P' : 'S'}
                      label={template.label}
                      title={template.description || `Saved ${template.kind} template`}
                      wide
                      onClick={() => {
                        if (!disabled) onAddCustomTemplate(template.id);
                      }}
                      onDragEnd={onPaletteDragEnd}
                      onDragStart={event => handleCustomTemplateDragStart(event, template.id)}
                    />
                    <button
                      aria-label={`Delete ${template.label}`}
                      className="builder-icon-button builder-icon-button--danger"
                      title="Delete saved template"
                      type="button"
                      onClick={() => onRemoveCustomTemplate(template.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customTemplates.length === 0 && (
            <div className="builder-template-transfer-actions">
              <button
                className="usa-button usa-button--outline"
                disabled={disabled}
                type="button"
                onClick={() => customTemplateInputRef.current?.click()}
              >
                Import saved templates
              </button>
            </div>
          )}

          <input
            accept="application/json,.json"
            className="builder-hidden-input"
            ref={customTemplateInputRef}
            type="file"
            onChange={event => handleCustomTemplateImport(event.target.files?.[0])}
          />

          {templateTransferMessage && (
            <p className="builder-action-message">{templateTransferMessage}</p>
          )}

          <div>
            <h3>Reusable sections</h3>
            <div className="builder-tool-grid">
              {screenSectionTemplates.map(template => (
                <ToolTile
                  disabled={disabled}
                  icon="S"
                  key={template.id}
                  label={template.label}
                  title={template.description}
                  wide
                  onClick={() => {
                    if (!disabled) onAddSection(template.id, {
                      includeAuthoringHelpers: includeTemplateHelpers,
                    });
                  }}
                  onDragEnd={onPaletteDragEnd}
                  onDragStart={event => handleTemplateDragStart(event, template.id)}
                />
              ))}
            </div>
          </div>

          {advancedTemplates.length > 0 && (
            <div>
              <h3>Advanced</h3>
              <div className="builder-tool-grid">
                {advancedTemplates.map(template => (
                  <ToolTile
                    disabled={disabled}
                    icon="R"
                    key={template.id}
                    label={template.label}
                    title={template.description}
                    wide
                    onClick={() => {
                      if (!disabled) onAddSection(template.id, {
                        includeAuthoringHelpers: includeTemplateHelpers,
                      });
                    }}
                    onDragEnd={onPaletteDragEnd}
                    onDragStart={event => handleTemplateDragStart(event, template.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ToolTile({
  disabled = false,
  draggable = true,
  icon,
  label,
  title,
  wide = false,
  onClick,
  onDragEnd,
  onDragStart,
}: ToolTileProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <div
      aria-disabled={disabled}
      aria-label={`Add ${label}`}
      className={`builder-tool-tile ${wide ? 'builder-tool-tile--wide' : ''}`}
      draggable={!disabled && draggable}
      role="button"
      tabIndex={disabled ? -1 : 0}
      title={title}
      onClick={() => {
        if (!disabled) onClick();
      }}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      onKeyDown={handleKeyDown}
    >
      <span className="builder-tool-tile__icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
