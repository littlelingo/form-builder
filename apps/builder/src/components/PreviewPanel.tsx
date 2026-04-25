import { Fragment, useState } from 'react';

import { applyComputedValues, evaluateRule } from '../lib/core';
import type {
  LayoutWidth,
  ScreenTemplateId,
  SectionTemplateId,
  TemplateInsertionOptions,
} from '../lib/formModel';
import type { ReactNode } from 'react';
import type {
  AuthoringChapter,
  AuthoringComponent,
  AuthoringForm,
  AuthoringPage,
  ComponentSystemId,
  PaletteDragItem,
  PreviewData,
  SelectedNode,
} from '../types';

interface PreviewPanelProps {
  canvasMode: 'edit' | 'preview';
  form: AuthoringForm;
  previewData: PreviewData;
  previewSystem: ComponentSystemId;
  selected: SelectedNode;
  onAddComponent: (
    type: string,
    index: number,
    layoutWidth?: LayoutWidth,
    siblingId?: string,
  ) => void;
  onAddCustomTemplate: (
    templateId: string,
    index?: number,
    layoutWidth?: LayoutWidth,
    siblingId?: string,
  ) => void;
  onAddScreenTemplate: (
    templateId: ScreenTemplateId,
    options?: TemplateInsertionOptions,
  ) => void;
  onAddSectionTemplate: (
    templateId: SectionTemplateId,
    index?: number,
    layoutWidth?: LayoutWidth,
    siblingId?: string,
    options?: TemplateInsertionOptions,
  ) => void;
  onDuplicateComponent: (source: SelectedNode) => void;
  onMoveComponent: (
    source: SelectedNode,
    index: number,
    layoutWidth?: LayoutWidth,
    siblingId?: string,
  ) => void;
  onChangeComponentLayout: (
    source: SelectedNode,
    patch: { layoutWidth?: LayoutWidth; layoutNewRow?: boolean },
  ) => void;
  onPaletteDragEnd: () => void;
  onPreviewDataChange: (data: PreviewData) => void;
  onRemoveComponent: (source: SelectedNode) => void;
  onRemoveScreen: (source: SelectedNode) => void;
  onSelect: (selected: SelectedNode) => void;
  paletteDragItem: PaletteDragItem | null;
}

function optionValue(option: { value?: string; id?: string; label: string }) {
  return option.value || option.id || option.label;
}

function safeApplyComputedValues(form: AuthoringForm, previewData: PreviewData) {
  try {
    return applyComputedValues(form.computedValues || [], previewData) as PreviewData;
  } catch {
    return previewData;
  }
}

function evaluateVisible(rule: unknown, formData: PreviewData) {
  if (!rule) return true;
  try {
    return Boolean(evaluateRule(rule, formData));
  } catch {
    return true;
  }
}

function isVisible(component: AuthoringComponent, formData: PreviewData) {
  if (component.showIf) return evaluateVisible(component.showIf, formData);
  if (component.hideIf) return !evaluateVisible(component.hideIf, formData);
  return true;
}

function isRequired(component: AuthoringComponent, formData: PreviewData) {
  if (component.requiredIf) {
    try {
      return Boolean(evaluateRule(component.requiredIf, formData));
    } catch {
      return Boolean(component.required);
    }
  }

  return Boolean(component.required);
}

function inputType(component: AuthoringComponent) {
  if (component.inputType) return component.inputType;
  if (component.type === 'email') return 'email';
  if (component.type === 'phone') return 'tel';
  if (component.type === 'date') return 'date';
  if (component.type === 'timePicker') return 'time';
  if (component.type === 'search') return 'search';
  return 'text';
}

function fieldValue(data: PreviewData, componentId: string) {
  const value = data[componentId];
  return value === undefined || value === null ? '' : String(value);
}

function textValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function selectedValues(data: PreviewData, componentId: string) {
  const value = data[componentId];
  return Array.isArray(value) ? value.map(String) : [];
}

function updateField(data: PreviewData, componentId: string, value: unknown) {
  return {
    ...data,
    [componentId]: value,
  };
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function memorableDateParts(value: unknown) {
  const [year = '', month = '', day = ''] = String(value || '').split('-');
  return { day, month, year };
}

function updateMemorableDatePart(value: unknown, part: 'day' | 'month' | 'year', nextValue: string) {
  const current = memorableDateParts(value);
  const next = { ...current, [part]: nextValue.replace(/\D/g, '') };
  if (!next.year && !next.month && !next.day) return '';
  return `${next.year}-${next.month}-${next.day}`;
}

function dateRangeParts(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as { startDate?: string; endDate?: string })
    : {};
}

function updateDateRangePart(value: unknown, part: 'startDate' | 'endDate', nextValue: string) {
  const current = dateRangeParts(value);
  const next = { ...current, [part]: nextValue };
  if (!next.startDate && !next.endDate) return '';
  return next;
}

function layoutLabel(component: AuthoringComponent) {
  if (component.layoutWidth === 'half') return 'Half width';
  if (component.layoutWidth === 'third') return 'Third width';
  return 'Full width';
}

const layoutOptions: Array<{ value: LayoutWidth; label: string; icon: string }> = [
  { value: 'full', label: 'Full width', icon: '1' },
  { value: 'half', label: 'Half width', icon: '1/2' },
  { value: 'third', label: 'Third width', icon: '1/3' },
];

function toggleArrayValue(value: unknown, option: string, checked: boolean) {
  const values = Array.isArray(value) ? value.map(String) : [];
  if (checked && !values.includes(option)) return [...values, option];
  if (!checked) return values.filter(item => item !== option);
  return values;
}

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map(String) : fallback;
}

function hasBuilderDragData(
  event: React.DragEvent<HTMLElement>,
  paletteDragItem: PaletteDragItem | null,
) {
  if (paletteDragItem) return true;

  if (
    [
    'application/x-va-component-type',
    'application/x-va-screen-template',
    'application/x-va-section-template',
    'application/x-va-custom-template',
    'application/x-va-field-node',
    ].some(type => event.dataTransfer.types.includes(type))
  ) {
    return true;
  }

  if (!event.dataTransfer.types.includes('text/plain')) return false;
  const text = event.dataTransfer.getData('text/plain');
  return text.startsWith('component:') || text.startsWith('section:') || text.startsWith('custom-template:');
}

function textDragPayload(event: React.DragEvent<HTMLElement>) {
  return event.dataTransfer.getData('text/plain');
}

function fallbackComponentType(event: React.DragEvent<HTMLElement>) {
  const text = textDragPayload(event);
  return text.startsWith('component:') ? text.replace(/^component:/, '') : '';
}

function fallbackSectionTemplate(event: React.DragEvent<HTMLElement>) {
  const text = textDragPayload(event);
  return text.startsWith('section:') ? text.replace(/^section:/, '') : '';
}

function fallbackCustomTemplate(event: React.DragEvent<HTMLElement>) {
  const text = textDragPayload(event);
  return text.startsWith('custom-template:') ? text.replace(/^custom-template:/, '') : '';
}

function paletteComponentType(paletteDragItem: PaletteDragItem | null) {
  return paletteDragItem?.kind === 'component' ? paletteDragItem.type : '';
}

function paletteSectionTemplate(paletteDragItem: PaletteDragItem | null) {
  return paletteDragItem?.kind === 'section' ? paletteDragItem.templateId : '';
}

function paletteScreenTemplate(paletteDragItem: PaletteDragItem | null) {
  return paletteDragItem?.kind === 'screen' ? paletteDragItem.templateId : '';
}

function paletteCustomTemplate(paletteDragItem: PaletteDragItem | null) {
  return paletteDragItem?.kind === 'customTemplate' ? paletteDragItem.templateId : '';
}

function templateInsertionOptions(
  event: React.DragEvent<HTMLElement>,
  paletteDragItem: PaletteDragItem | null,
): TemplateInsertionOptions {
  const helperSetting = event.dataTransfer.getData('application/x-va-template-helpers');
  if (helperSetting === 'skip') return { includeAuthoringHelpers: false };
  if (
    (paletteDragItem?.kind === 'section' || paletteDragItem?.kind === 'screen') &&
    paletteDragItem.includeAuthoringHelpers === false
  ) {
    return { includeAuthoringHelpers: false };
  }
  return { includeAuthoringHelpers: true };
}

function FieldShell({
  component,
  children,
  formData,
  previewSystem,
}: {
  component: AuthoringComponent;
  children: ReactNode;
  formData: PreviewData;
  previewSystem: ComponentSystemId;
}) {
  const shadcn = previewSystem === 'shadcn';
  const required = isRequired(component, formData);

  return (
    <div className={shadcn ? 'shadcn-field' : 'usa-form-group'}>
      <label className={shadcn ? 'shadcn-label' : 'usa-label'} htmlFor={`preview-${component.id}`}>
        {component.label}
        {required && <span className="builder-required"> required</span>}
      </label>
      {component.hint && (
        <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>{component.hint}</span>
      )}
      {children}
    </div>
  );
}

function LayoutActionGroup({
  component,
  node,
  onChangeComponentLayout,
}: {
  component: AuthoringComponent;
  node: SelectedNode;
  onChangeComponentLayout?: (
    source: SelectedNode,
    patch: { layoutWidth?: LayoutWidth; layoutNewRow?: boolean },
  ) => void;
}) {
  const currentWidth = component.layoutWidth || 'full';
  const [open, setOpen] = useState(false);

  return (
    <div
      className="builder-layout-menu"
      aria-label={`${component.label} layout`}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-label={`Change ${component.label} layout`}
        className="builder-icon-button builder-layout-menu__trigger"
        title="Layout"
        type="button"
        onClick={event => {
          event.stopPropagation();
          setOpen(current => !current);
        }}
      >
        ▦
      </button>
      {open && (
        <div className="builder-layout-menu__popover" role="group" aria-label={`${component.label} layout options`}>
          {layoutOptions.map(option => (
            <button
              aria-label={`Set ${component.label} to ${option.label}`}
              aria-pressed={currentWidth === option.value}
              className="builder-layout-action"
              key={option.value}
              title={option.label}
              type="button"
              onClick={event => {
                event.stopPropagation();
                onChangeComponentLayout?.(node, { layoutWidth: option.value });
                setOpen(false);
              }}
            >
              {option.icon}
            </button>
          ))}
          <button
            aria-label={`${component.layoutNewRow ? 'Stop' : 'Start'} ${component.label} on a new row`}
            aria-pressed={Boolean(component.layoutNewRow)}
            className="builder-layout-action"
            title={component.layoutNewRow ? 'Do not start new row' : 'Start new row'}
            type="button"
            onClick={event => {
              event.stopPropagation();
              onChangeComponentLayout?.(node, { layoutNewRow: !component.layoutNewRow });
              setOpen(false);
            }}
          >
            ↵
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewField({
  component,
  editMode,
  formData,
  node,
  onChange,
  onChangeComponentLayout,
  onDuplicateComponent,
  onRemoveComponent,
  onSelect,
  previewSystem,
  selectedComponentId,
}: {
  component: AuthoringComponent;
  editMode?: boolean;
  formData: PreviewData;
  node?: SelectedNode;
  onChange: (componentId: string, value: unknown) => void;
  onChangeComponentLayout?: (
    source: SelectedNode,
    patch: { layoutWidth?: LayoutWidth; layoutNewRow?: boolean },
  ) => void;
  onDuplicateComponent?: (source: SelectedNode) => void;
  onRemoveComponent?: (source: SelectedNode) => void;
  onSelect?: (selected: SelectedNode) => void;
  previewSystem: ComponentSystemId;
  selectedComponentId?: string;
}) {
  const shadcn = previewSystem === 'shadcn';
  const inputClass = shadcn ? 'shadcn-input' : 'usa-input';
  const textareaClass = shadcn ? 'shadcn-textarea' : 'usa-textarea';
  const required = isRequired(component, formData);
  const [maskedVisible, setMaskedVisible] = useState(false);

  if (component.type === 'sectionGroup') {
    return (
      <section className="builder-section-group-preview">
        <div className="builder-section-group-preview__header">
          <h3>{component.label}</h3>
          {component.description && <p>{component.description}</p>}
        </div>
        <div className="builder-section-group-preview__body">
          {(component.children || []).map(child => (
            <div
              className={`builder-section-child-preview ${
                selectedComponentId === child.id ? 'is-selected' : ''
              }`}
              key={child.id}
              role={editMode ? 'button' : undefined}
              tabIndex={editMode ? 0 : undefined}
              onClick={event => {
                if (!editMode || !node) return;
                event.stopPropagation();
                onSelect?.({ ...node, componentId: child.id });
              }}
              onKeyDown={event => {
                if (!editMode || !node) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelect?.({ ...node, componentId: child.id });
                }
              }}
            >
              {editMode && node && (
                <div className="builder-section-child-preview__actions" aria-label={`${child.label} actions`}>
                  {selectedComponentId === child.id && (
                    <LayoutActionGroup
                      component={child}
                      node={{ ...node, componentId: child.id }}
                      onChangeComponentLayout={onChangeComponentLayout}
                    />
                  )}
                  <button
                    aria-label={`Duplicate ${child.label}`}
                    className="builder-icon-button"
                    title="Duplicate field"
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      onDuplicateComponent?.({ ...node, componentId: child.id });
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    aria-label={`Remove ${child.label}`}
                    className="builder-icon-button builder-icon-button--danger"
                    title="Remove field"
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      onRemoveComponent?.({ ...node, componentId: child.id });
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              <PreviewField
                component={child}
                editMode={editMode}
                formData={formData}
                node={node ? { ...node, componentId: child.id } : undefined}
                previewSystem={previewSystem}
                selectedComponentId={selectedComponentId}
                onChange={onChange}
                onChangeComponentLayout={onChangeComponentLayout}
                onDuplicateComponent={onDuplicateComponent}
                onRemoveComponent={onRemoveComponent}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (component.type === 'alert') {
    return (
      <div className={`usa-alert usa-alert--${component.alertType || 'info'} builder-content-block`}>
        <div className="usa-alert__body">
          <h3 className="usa-alert__heading">{component.label}</h3>
          <p className="usa-alert__text">{component.description || component.hint || 'Important information.'}</p>
        </div>
      </div>
    );
  }

  if (component.type === 'summaryBox') {
    return (
      <div className="usa-summary-box builder-content-block">
        <div className="usa-summary-box__body">
          <h3 className="usa-summary-box__heading">{component.label}</h3>
          <p>{component.description || 'Summary content.'}</p>
        </div>
      </div>
    );
  }

  if (component.type === 'accordion') {
    return (
      <div className="builder-content-block builder-accordion-preview">
        <button className="usa-accordion__button" type="button">
          {component.label}
        </button>
        {component.defaultOpen !== false && (
          <div className="usa-accordion__content">{component.description || 'Accordion content.'}</div>
        )}
      </div>
    );
  }

  if (component.type === 'card') {
    return (
      <div className="usa-card builder-content-block">
        <div className="usa-card__container">
          <div className="usa-card__header">
            <h3 className="usa-card__heading">{component.label}</h3>
          </div>
          <div className="usa-card__body">
            <p>{component.description || 'Card content.'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (component.type === 'prose') {
    return (
      <div className="usa-prose builder-content-block">
        <h3>{component.label}</h3>
        <p>{component.description || component.hint || 'Instructional text.'}</p>
      </div>
    );
  }

  if (component.type === 'table') {
    const rows = Array.isArray(component.rows) ? component.rows : [];
    const hasHeader = component.headerRow !== false && rows.length > 0;
    const bodyRows = hasHeader ? rows.slice(1) : rows;
    return (
      <table className="usa-table builder-content-block">
        <caption>{component.label}</caption>
        {hasHeader && (
          <thead>
            <tr>
              {Array.isArray(rows[0]) &&
                rows[0].map((cell, cellIndex) => (
                  <th key={`${component.id}-header-${cellIndex}`} scope="col">
                    {String(cell)}
                  </th>
                ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, index) => (
            <tr key={`${component.id}-row-${index}`}>
              {Array.isArray(row) &&
                row.map((cell, cellIndex) => <td key={`${component.id}-${index}-${cellIndex}`}>{String(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (component.type === 'tag') {
    return <span className="usa-tag">{component.label}</span>;
  }

  if (component.type === 'processList') {
    return (
      <ol className="usa-process-list builder-content-block">
        {stringArray(component.items, ['Step one', 'Step two']).map(item => (
          <li className="usa-process-list__item" key={item}>
            <h3 className="usa-process-list__heading">{item}</h3>
          </li>
        ))}
      </ol>
    );
  }

  if (component.type === 'button') {
    const buttonClass =
      component.buttonStyle === 'secondary'
        ? 'usa-button usa-button--secondary'
        : component.buttonStyle === 'outline'
          ? 'usa-button usa-button--outline'
          : 'usa-button';

    return (
      <button className={buttonClass} type="button">
        {component.label}
      </button>
    );
  }

  if (component.type === 'buttonGroup') {
    return (
      <div className="usa-button-group builder-content-block">
        <button className="usa-button" type="button">
          {String(component.primaryLabel || 'Primary action')}
        </button>
        <button className="usa-button usa-button--secondary" type="button">
          {String(component.secondaryLabel || 'Secondary action')}
        </button>
      </div>
    );
  }

  if (component.type === 'textArea' || component.type === 'characterCount') {
    const value = fieldValue(formData, component.id);
    const maxLength = Number(component.maxLength || 500);
    return (
      <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
        <textarea
          className={textareaClass}
          id={`preview-${component.id}`}
          maxLength={
            component.type === 'characterCount'
              ? maxLength
              : component.maxLength
                ? Number(component.maxLength)
                : undefined
          }
          minLength={component.minLength ? Number(component.minLength) : undefined}
          placeholder={String(component.placeholder || '')}
          value={value}
          onChange={event => onChange(component.id, event.target.value)}
        />
        {component.type === 'characterCount' && (
          <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>
            {Math.max(0, maxLength - value.length)} characters remaining
          </span>
        )}
      </FieldShell>
    );
  }

  if (component.type === 'radioButton' || component.type === 'yesNo') {
    const options =
      component.type === 'yesNo'
        ? [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]
        : component.responseOptions || [];

    return (
      <fieldset className={shadcn ? 'shadcn-fieldset' : 'usa-fieldset'}>
        <legend className={shadcn ? 'shadcn-label' : 'usa-legend'}>
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </legend>
        {component.hint && (
          <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>{component.hint}</span>
        )}
        {options.map(option => (
          <div className={shadcn ? 'shadcn-choice' : 'usa-radio'} key={optionValue(option)}>
            <input
              checked={fieldValue(formData, component.id) === optionValue(option)}
              className={shadcn ? 'shadcn-radio' : 'usa-radio__input'}
              id={`preview-${component.id}-${optionValue(option)}`}
              name={`preview-${component.id}`}
              type="radio"
              onChange={() =>
                onChange(
                  component.id,
                  component.type === 'yesNo' ? option.value === 'true' : optionValue(option),
                )
              }
            />
            <label
              className={shadcn ? 'shadcn-choice-label' : 'usa-radio__label'}
              htmlFor={`preview-${component.id}-${optionValue(option)}`}
            >
              {option.label}
            </label>
          </div>
        ))}
      </fieldset>
    );
  }

  if (component.type === 'checkbox') {
    return (
      <fieldset className={shadcn ? 'shadcn-fieldset' : 'usa-fieldset'}>
        <legend className={shadcn ? 'shadcn-label' : 'usa-legend'}>{component.label}</legend>
        {(component.responseOptions || []).map(option => (
          <div className={shadcn ? 'shadcn-choice' : 'usa-checkbox'} key={optionValue(option)}>
            <input
              checked={selectedValues(formData, component.id).includes(optionValue(option))}
              className={shadcn ? 'shadcn-checkbox' : 'usa-checkbox__input'}
              id={`preview-${component.id}-${optionValue(option)}`}
              type="checkbox"
              onChange={event =>
                onChange(
                  component.id,
                  toggleArrayValue(formData[component.id], optionValue(option), event.target.checked),
                )
              }
            />
            <label
              className={shadcn ? 'shadcn-choice-label' : 'usa-checkbox__label'}
              htmlFor={`preview-${component.id}-${optionValue(option)}`}
            >
              {option.label}
            </label>
          </div>
        ))}
      </fieldset>
    );
  }

  if (component.type === 'select' || component.type === 'comboBox') {
    return (
      <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
        {component.type === 'comboBox' && (
          <input
            className={inputClass}
            list={`preview-${component.id}-options`}
            value={fieldValue(formData, component.id)}
            onChange={event => onChange(component.id, event.target.value)}
          />
        )}
        {component.type === 'comboBox' ? (
          <datalist id={`preview-${component.id}-options`}>
            {(component.responseOptions || []).map(option => (
              <option key={optionValue(option)} value={option.label} />
            ))}
          </datalist>
        ) : (
        <select
          className={shadcn ? 'shadcn-select' : 'usa-select'}
          id={`preview-${component.id}`}
          value={fieldValue(formData, component.id)}
          onChange={event => onChange(component.id, event.target.value)}
        >
          <option value="">- Select -</option>
          {(component.responseOptions || []).map(option => (
            <option key={optionValue(option)} value={optionValue(option)}>
              {option.label}
            </option>
          ))}
        </select>
        )}
      </FieldShell>
    );
  }

  if (component.type === 'dateRange') {
    const value = formData[component.id];
    const parts = dateRangeParts(value);
    return (
      <fieldset className={shadcn ? 'shadcn-fieldset' : 'usa-fieldset'}>
        <legend className={shadcn ? 'shadcn-label' : 'usa-legend'}>{component.label}</legend>
        {component.hint && (
          <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>{component.hint}</span>
        )}
        <div className="builder-two-column">
          <label>
            <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>
              {textValue(component.startLabel) || 'Start date'}
            </span>
            <input
              className={inputClass}
              type="date"
              value={textValue(parts.startDate)}
              onChange={event =>
                onChange(component.id, updateDateRangePart(value, 'startDate', event.target.value))
              }
            />
          </label>
          <label>
            <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>
              {textValue(component.endLabel) || 'End date'}
            </span>
            <input
              className={inputClass}
              type="date"
              value={textValue(parts.endDate)}
              onChange={event =>
                onChange(component.id, updateDateRangePart(value, 'endDate', event.target.value))
              }
            />
          </label>
        </div>
      </fieldset>
    );
  }

  if (component.type === 'memorableDate') {
    const value = formData[component.id];
    const parts = memorableDateParts(value);
    return (
      <fieldset className={shadcn ? 'shadcn-fieldset' : 'usa-fieldset'}>
        <legend className={shadcn ? 'shadcn-label' : 'usa-legend'}>{component.label}</legend>
        {component.hint && (
          <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>{component.hint}</span>
        )}
        <div className="builder-three-column">
          <label>
            <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>Month</span>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={2}
              placeholder="MM"
              value={parts.month}
              onChange={event =>
                onChange(component.id, updateMemorableDatePart(value, 'month', event.target.value))
              }
            />
          </label>
          <label>
            <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>Day</span>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={2}
              placeholder="DD"
              value={parts.day}
              onChange={event =>
                onChange(component.id, updateMemorableDatePart(value, 'day', event.target.value))
              }
            />
          </label>
          <label>
            <span className={shadcn ? 'shadcn-description' : 'usa-hint'}>Year</span>
            <input
              className={inputClass}
              inputMode="numeric"
              maxLength={4}
              placeholder="YYYY"
              value={parts.year}
              onChange={event =>
                onChange(component.id, updateMemorableDatePart(value, 'year', event.target.value))
              }
            />
          </label>
        </div>
      </fieldset>
    );
  }

  if (component.type === 'switch') {
    return (
      <div className="usa-checkbox builder-switch-preview">
        <input
          checked={Boolean(formData[component.id])}
          className="usa-checkbox__input"
          id={`preview-${component.id}`}
          type="checkbox"
          onChange={event => onChange(component.id, event.target.checked)}
        />
        <label className="usa-checkbox__label" htmlFor={`preview-${component.id}`}>
          {component.label}
        </label>
      </div>
    );
  }

  if (component.type === 'rangeSlider') {
    return (
      <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
        <input
          id={`preview-${component.id}`}
          max={Number(component.maximum || 100)}
          min={Number(component.minimum || 0)}
          step={Number(component.step || 1)}
          type="range"
          value={fieldValue(formData, component.id) || 0}
          onChange={event => onChange(component.id, Number(event.target.value))}
        />
      </FieldShell>
    );
  }

  if (component.type === 'inputGroup') {
    return (
      <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
        <div className="builder-input-group-preview">
          {component.prefix ? <span>{String(component.prefix)}</span> : null}
          <input
            className={inputClass}
            id={`preview-${component.id}`}
            autoComplete={textValue(component.autocomplete)}
            max={component.maximum ? String(component.maximum) : undefined}
            maxLength={component.maxLength ? Number(component.maxLength) : undefined}
            min={component.minimum ? String(component.minimum) : undefined}
            minLength={component.minLength ? Number(component.minLength) : undefined}
            pattern={textValue(component.pattern) || undefined}
            placeholder={String(component.placeholder || '')}
            type={inputType(component)}
            value={fieldValue(formData, component.id)}
            onChange={event =>
              onChange(
                component.id,
                component.type === 'phone'
                  ? formatPhoneNumber(event.target.value)
                  : event.target.value,
              )
            }
          />
          {component.suffix ? <span>{String(component.suffix)}</span> : null}
        </div>
      </FieldShell>
    );
  }

  if (component.type === 'maskedInput') {
    return (
      <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
        <div className="builder-masked-input-preview">
          <input
            className={inputClass}
            id={`preview-${component.id}`}
            placeholder={String(component.placeholder || '')}
            type={maskedVisible ? 'text' : 'password'}
            value={fieldValue(formData, component.id)}
            onChange={event => onChange(component.id, event.target.value)}
          />
          {component.allowReveal !== false && (
            <button type="button" onClick={() => setMaskedVisible(value => !value)}>
              {maskedVisible ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </FieldShell>
    );
  }

  if (component.type === 'fileUpload') {
    const fileNames = selectedValues(formData, component.id);

    return (
      <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
        <input
          className={shadcn ? 'shadcn-input' : 'usa-file-input'}
          id={`preview-${component.id}`}
          accept={Array.isArray(component.accept) ? component.accept.map(String).join(',') : undefined}
          multiple={Boolean(component.multiple)}
          type="file"
          onChange={event =>
            onChange(
              component.id,
              Array.from(event.target.files || []).map(file => file.name),
            )
          }
        />
        {fileNames.length > 0 && (
          <p className="builder-preview__file-note">Selected: {fileNames.join(', ')}</p>
        )}
      </FieldShell>
    );
  }

  return (
    <FieldShell component={component} formData={formData} previewSystem={previewSystem}>
      <input
        className={inputClass}
        id={`preview-${component.id}`}
        autoComplete={textValue(component.autocomplete)}
        inputMode={component.type === 'phone' ? 'tel' : undefined}
        max={component.maximum ? String(component.maximum) : undefined}
        maxLength={component.maxLength ? Number(component.maxLength) : undefined}
        min={component.minimum ? String(component.minimum) : undefined}
        minLength={component.minLength ? Number(component.minLength) : undefined}
        pattern={textValue(component.pattern) || undefined}
        placeholder={String(component.placeholder || '')}
        type={inputType(component)}
        value={fieldValue(formData, component.id)}
        onChange={event =>
          onChange(
            component.id,
            component.type === 'phone' ? formatPhoneNumber(event.target.value) : event.target.value,
          )
        }
      />
    </FieldShell>
  );
}

function currentSelection(
  form: AuthoringForm,
  selected: SelectedNode,
): { chapter?: AuthoringChapter; page?: AuthoringPage } {
  const chapter = form.chapters.find(item => item.id === selected.chapterId) || form.chapters[0];
  const page = chapter?.pages.find(item => item.id === selected.pageId) || chapter?.pages[0];
  return { chapter, page };
}

export function PreviewPanel({
  canvasMode,
  form,
  previewData,
  previewSystem,
  selected,
  onAddComponent,
  onAddCustomTemplate,
  onAddScreenTemplate,
  onAddSectionTemplate,
  onChangeComponentLayout,
  onDuplicateComponent,
  onMoveComponent,
  onPaletteDragEnd,
  onPreviewDataChange,
  onRemoveComponent,
  onRemoveScreen,
  onSelect,
  paletteDragItem,
}: PreviewPanelProps) {
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { chapter, page } = currentSelection(form, selected);
  const editMode = canvasMode === 'edit';
  const computedPreviewData = safeApplyComputedValues(form, previewData);
  const chapterVisible = evaluateVisible(chapter?.condition, computedPreviewData);
  const pageVisible = evaluateVisible(page?.condition, computedPreviewData);
  const hiddenCount =
    page?.components.filter(component => !isVisible(component, computedPreviewData)).length || 0;
  const selectedScreen = {
    chapterId: chapter?.id || '',
    pageId: page?.id || '',
  };

  function handleFieldChange(componentId: string, value: unknown) {
    onPreviewDataChange(updateField(previewData, componentId, value));
  }

  function handleDragStart(event: React.DragEvent<HTMLDivElement>, component: AuthoringComponent) {
    if (!editMode) return;
    setDragActive(true);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/x-va-field-node',
      JSON.stringify({
        chapterId: chapter?.id,
        pageId: page?.id,
        componentId: component.id,
      }),
    );
    event.dataTransfer.setData('text/plain', component.label);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    if (!editMode) return;
    const componentType =
      event.dataTransfer.getData('application/x-va-component-type') ||
      fallbackComponentType(event) ||
      paletteComponentType(paletteDragItem);
    const screenTemplate =
      event.dataTransfer.getData('application/x-va-screen-template') ||
      paletteScreenTemplate(paletteDragItem);
    const sectionTemplate =
      event.dataTransfer.getData('application/x-va-section-template') ||
      fallbackSectionTemplate(event) ||
      paletteSectionTemplate(paletteDragItem);
    const customTemplate =
      event.dataTransfer.getData('application/x-va-custom-template') ||
      fallbackCustomTemplate(event) ||
      paletteCustomTemplate(paletteDragItem);
    const fieldNode = event.dataTransfer.getData('application/x-va-field-node');
    const insertionOptions = templateInsertionOptions(event, paletteDragItem);

    if (componentType) {
      onAddComponent(componentType, index);
    } else if (screenTemplate) {
      onAddScreenTemplate(screenTemplate as ScreenTemplateId, insertionOptions);
    } else if (sectionTemplate) {
      onAddSectionTemplate(sectionTemplate as SectionTemplateId, index, undefined, undefined, insertionOptions);
    } else if (customTemplate) {
      onAddCustomTemplate(customTemplate, index);
    } else if (fieldNode) {
      onMoveComponent(JSON.parse(fieldNode) as SelectedNode, index);
    }

    setDropIndex(null);
    setDragActive(false);
    onPaletteDragEnd();
  }

  function handleSideDrop(
    event: React.DragEvent<HTMLDivElement>,
    index: number,
    siblingId: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!editMode) return;
    const componentType =
      event.dataTransfer.getData('application/x-va-component-type') ||
      fallbackComponentType(event) ||
      paletteComponentType(paletteDragItem);
    const screenTemplate =
      event.dataTransfer.getData('application/x-va-screen-template') ||
      paletteScreenTemplate(paletteDragItem);
    const sectionTemplate =
      event.dataTransfer.getData('application/x-va-section-template') ||
      fallbackSectionTemplate(event) ||
      paletteSectionTemplate(paletteDragItem);
    const customTemplate =
      event.dataTransfer.getData('application/x-va-custom-template') ||
      fallbackCustomTemplate(event) ||
      paletteCustomTemplate(paletteDragItem);
    const fieldNode = event.dataTransfer.getData('application/x-va-field-node');
    const insertionOptions = templateInsertionOptions(event, paletteDragItem);

    if (componentType) {
      onAddComponent(componentType, index, 'half', siblingId);
    } else if (screenTemplate) {
      onAddScreenTemplate(screenTemplate as ScreenTemplateId, insertionOptions);
    } else if (sectionTemplate) {
      onAddSectionTemplate(sectionTemplate as SectionTemplateId, index, 'half', siblingId, insertionOptions);
    } else if (customTemplate) {
      onAddCustomTemplate(customTemplate, index, 'half', siblingId);
    } else if (fieldNode) {
      onMoveComponent(JSON.parse(fieldNode) as SelectedNode, index, 'half', siblingId);
    }

    setDropIndex(null);
    setDragActive(false);
    onPaletteDragEnd();
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>, index: number) {
    if (!editMode || !hasBuilderDragData(event, paletteDragItem)) return;
    event.preventDefault();
    const isPaletteDrag =
      Boolean(paletteDragItem) ||
      event.dataTransfer.types.includes('application/x-va-component-type') ||
      event.dataTransfer.types.includes('application/x-va-screen-template') ||
      event.dataTransfer.types.includes('application/x-va-section-template') ||
      event.dataTransfer.types.includes('application/x-va-custom-template');
    event.dataTransfer.dropEffect = isPaletteDrag ? 'copy' : 'move';
    setDropIndex(index);
    setDragActive(true);
  }

  function handleTargetDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!editMode || !hasBuilderDragData(event, paletteDragItem)) return;
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function handleTargetDrop(event: React.DragEvent<HTMLDivElement>, index: number) {
    event.stopPropagation();
    handleDrop(event, index);
  }

  function handleLaneDragOver(event: React.DragEvent<HTMLDivElement>, index: number) {
    event.stopPropagation();
    handleDragOver(event, index);
  }

  function canvasDropIndex(event: React.DragEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('.builder-canvas-item'),
    );
    if (items.length === 0) return 0;

    const pointerY = event.clientY;
    const nextIndex = items.findIndex(item => {
      const rect = item.getBoundingClientRect();
      return pointerY < rect.top + rect.height / 2;
    });

    return nextIndex === -1 ? items.length : nextIndex;
  }

  function handleCanvasDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (event.defaultPrevented || !editMode || !hasBuilderDragData(event, paletteDragItem)) return;
    handleDragOver(event, canvasDropIndex(event));
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    if (event.defaultPrevented || !editMode || !hasBuilderDragData(event, paletteDragItem)) return;
    handleDrop(event, canvasDropIndex(event));
  }

  return (
    <section className="builder-card builder-preview" aria-labelledby="preview-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Canvas</p>
          <h2 id="preview-heading">{page?.title || 'Start building'}</h2>
        </div>
        <div className="builder-canvas-header-actions">
          {editMode && page && (
            <button
              aria-label={`Remove ${page.title}`}
              className="builder-icon-button builder-icon-button--danger"
              title="Remove screen"
              type="button"
              onClick={() => onRemoveScreen(selectedScreen)}
            >
              x
            </button>
          )}
          <span className="builder-canvas-badge">{previewSystem === 'shadcn' ? 'shadcn/ui' : 'USWDS'}</span>
        </div>
      </div>

      {page?.bodyText && <p className="builder-preview__body">{page.bodyText}</p>}

      {(!chapterVisible || !pageVisible) && (
        <div className="usa-alert usa-alert--warning usa-alert--slim builder-alert">
          <div className="usa-alert__body">
            <p className="usa-alert__text">
              This {chapterVisible ? 'screen' : 'section'} is hidden for the current sample data.
            </p>
          </div>
        </div>
      )}

      <div
        className={`builder-canvas ${editMode ? 'is-edit-mode' : 'is-preview-mode'} ${
          dragActive ? 'is-dragging' : ''
        } ${
          previewSystem === 'shadcn' ? 'shadcn-preview' : 'uswds-preview'
        }`}
        onDragOver={handleCanvasDragOver}
        onDragEnd={() => {
          setDropIndex(null);
          setDragActive(false);
          onPaletteDragEnd();
        }}
        onDragLeave={event => {
          setDropIndex(null);
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={handleCanvasDrop}
      >
        {editMode && (
          <DropZone
            active={dropIndex === 0}
            index={0}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        )}
        {(page?.components || []).map((component, componentIndex) => {
          const visible = isVisible(component, computedPreviewData);
          const node = {
            chapterId: chapter?.id || '',
            pageId: page?.id || '',
            componentId: component.id,
          };
          return (
            <Fragment key={component.id}>
              {editMode && (
                <DropZone
                  active={dropIndex === componentIndex}
                  index={componentIndex}
                  label={
                    componentIndex === 0
                      ? 'Drop as first field'
                      : `Drop between fields ${componentIndex} and ${componentIndex + 1}`
                  }
                  onDragOver={handleLaneDragOver}
                  onDrop={handleDrop}
                />
              )}
              <div
                className={`builder-canvas-item ${
                  component.layoutWidth === 'third'
                    ? 'is-third'
                    : component.layoutWidth === 'half'
                      ? 'is-half'
                      : 'is-full'
                } ${component.layoutNewRow ? 'starts-row' : ''}`}
              >
                {editMode && <span className="builder-canvas-layout-label">{layoutLabel(component)}</span>}
                <div
                  className={`builder-canvas-field ${
                    selected.componentId === component.id ? 'is-selected' : ''
                  } ${visible ? '' : 'is-hidden'}`}
                  draggable={editMode}
                  role={editMode ? 'button' : undefined}
                  tabIndex={editMode ? 0 : undefined}
                  onClick={() => {
                    if (editMode) onSelect(node);
                  }}
                  onDragStart={event => handleDragStart(event, component)}
                  onKeyDown={event => {
                    if (editMode && (event.key === 'Enter' || event.key === ' ')) {
                      onSelect(node);
                    }
                  }}
                >
                  {editMode && (
                    <>
                      <div className="builder-canvas-row-drop builder-canvas-row-drop--top">
                        <div
                          aria-label={`Drop above ${component.label}`}
                          onDragOver={handleTargetDragOver}
                          onDrop={event => handleTargetDrop(event, componentIndex)}
                        />
                      </div>
                      <div className="builder-canvas-row-drop builder-canvas-row-drop--bottom">
                        <div
                          aria-label={`Drop below ${component.label}`}
                          onDragOver={handleTargetDragOver}
                          onDrop={event => handleTargetDrop(event, componentIndex + 1)}
                        />
                      </div>
                      <div className="builder-canvas-side-drop builder-canvas-side-drop--left">
                        <div
                          aria-label={`Drop beside ${component.label}`}
                          onDragOver={handleTargetDragOver}
                          onDrop={event => handleSideDrop(event, componentIndex, component.id)}
                        />
                      </div>
                      <div className="builder-canvas-side-drop builder-canvas-side-drop--right">
                        <div
                          aria-label={`Drop beside ${component.label}`}
                          onDragOver={handleTargetDragOver}
                          onDrop={event => handleSideDrop(event, componentIndex + 1, component.id)}
                        />
                      </div>
                    </>
                  )}
                  <div className="builder-canvas-field__body">
                    {editMode && (
                      <div
                        className="builder-canvas-field__actions"
                        aria-label={`${component.label} actions`}
                      >
                        <span className="builder-canvas-field__handle" aria-hidden="true">
                          ::
                        </span>
                        {selected.componentId === component.id && (
                          <LayoutActionGroup
                            component={component}
                            node={node}
                            onChangeComponentLayout={onChangeComponentLayout}
                          />
                        )}
                        <button
                          aria-label={`Duplicate ${component.label}`}
                          className="builder-icon-button"
                          title="Duplicate field"
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onDuplicateComponent(node);
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          aria-label={`Remove ${component.label}`}
                          className="builder-icon-button builder-icon-button--danger"
                          title="Remove field"
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onRemoveComponent(node);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {visible ? (
                      <PreviewField
                        component={component}
                        editMode={editMode}
                        formData={computedPreviewData}
                        node={node}
                        previewSystem={previewSystem}
                        selectedComponentId={selected.componentId}
                        onChange={handleFieldChange}
                        onChangeComponentLayout={onChangeComponentLayout}
                        onDuplicateComponent={onDuplicateComponent}
                        onRemoveComponent={onRemoveComponent}
                        onSelect={onSelect}
                      />
                    ) : (
                      <div className="builder-canvas-field__hidden">
                        <strong>{component.label}</strong>
                        <span>Hidden for current sample data</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        {editMode && page && page.components.length > 0 && (
          <DropZone
            active={dropIndex === page.components.length}
            index={page.components.length}
            label="Drop at end"
            onDragOver={handleLaneDragOver}
            onDrop={handleDrop}
          />
        )}
        {(!page || page.components.length === 0) && (
          <div
            className="builder-empty-canvas"
            onDragOver={event => handleDragOver(event, 0)}
            onDrop={event => handleDrop(event, 0)}
          >
            {editMode
              ? 'Drag a section, screen, or field from the toolbox onto this canvas.'
              : 'This form has no screen to preview yet.'}
          </div>
        )}
      </div>

      {hiddenCount > 0 && (
        <div className="usa-alert usa-alert--info usa-alert--slim builder-alert">
          <div className="usa-alert__body">
            <p className="usa-alert__text">
              {hiddenCount} field{hiddenCount === 1 ? ' is' : 's are'} conditionally hidden for the
              current sample data.
            </p>
          </div>
        </div>
      )}

      <div className="builder-preview-data">
        <div className="builder-card__header builder-card__header--split">
          <div>
            <p className="builder-eyebrow">Sample answers</p>
            <h3>Preview data</h3>
          </div>
          <button
            className="usa-button usa-button--secondary"
            type="button"
            onClick={() => onPreviewDataChange({})}
          >
            Clear
          </button>
        </div>

        <div className="builder-preview-data__grid">
          <div>
            <h4>Raw answers</h4>
            <pre className="builder-code-block builder-code-block--small">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
          <div>
            <h4>With computed values</h4>
            <pre className="builder-code-block builder-code-block--small">
              {JSON.stringify(computedPreviewData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function DropZone({
  active,
  index,
  label,
  onDragOver,
  onDrop,
}: {
  active: boolean;
  index: number;
  label?: string;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
}) {
  return (
    <div
      className={`builder-drop-zone ${active ? 'is-active' : ''}`}
      aria-label={label || `Drop at position ${index + 1}`}
      onDragOver={event => onDragOver(event, index)}
      onDrop={event => onDrop(event, index)}
    >
      <span>{label || 'Drop here'}</span>
    </div>
  );
}
