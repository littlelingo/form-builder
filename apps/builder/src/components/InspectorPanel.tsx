import { getComponentSystemSupport } from '../lib/core';
import { buildConfidenceInsight } from '../lib/confidenceInsights';
import { confidenceBand } from '../lib/reviewState';
import type { AuthoringComponent } from '../types';
import { ConditionEditor } from './ConditionEditor';
import { ConfidenceBadge } from './ConfidenceBadge';
import { EventHandlersEditor } from './EventHandlersEditor';
import { FieldValidationsEditor } from './FieldValidationsEditor';
import { InspectorSection } from './InspectorSection';

interface InspectorPanelProps {
  component?: AuthoringComponent;
  availableFields: AuthoringComponent[];
  onChange: (component: AuthoringComponent) => void;
  onRemove: () => void;
  onAcceptComponent?: (componentId: string) => void;
  onRejectComponent?: (componentId: string) => void;
}

function textValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function optionsToText(component: AuthoringComponent) {
  return (component.responseOptions || [])
    .map(option => `${option.value || option.id || ''}|${option.label}`)
    .join('\n');
}

function textToOptions(value: string) {
  return value
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .map(row => {
      const [optionValue, ...labelParts] = row.split('|');
      return {
        value: optionValue.trim(),
        label: (labelParts.join('|') || optionValue).trim(),
      };
    });
}

function arrayToCsv(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(', ') : '';
}

function csvToArray(value: string) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function linesToArray(value: string) {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: unknown, fallback: string[] = []) {
  return (Array.isArray(value) ? value : fallback).map(String).join('\n');
}

function tableToText(value: unknown) {
  if (!Array.isArray(value)) return '';
  return value
    .map(row => (Array.isArray(row) ? row.map(cell => String(cell)).join(' | ') : String(row)))
    .join('\n');
}

function textToTable(value: string) {
  return value
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .map(row => row.split('|').map(cell => cell.trim()));
}

function hasAnswerValue(component: AuthoringComponent) {
  return ![
    'sectionGroup',
    'alert',
    'summaryBox',
    'accordion',
    'card',
    'prose',
    'table',
    'tag',
    'processList',
    'button',
    'buttonGroup',
  ].includes(component.type);
}

function showLowConfidenceGuidance(component: AuthoringComponent): boolean {
  if (!component.provenance) return false;
  if (component.provenance.reviewed !== false) return false;
  if (!['pdf-field', 'pdf-static-region'].includes(component.provenance.origin)) return false;
  return confidenceBand(component.provenance.confidence) === 'low';
}

function supportsTextBehavior(component: AuthoringComponent) {
  return [
    'textInput',
    'email',
    'phone',
    'search',
    'inputGroup',
    'maskedInput',
    'textArea',
    'characterCount',
  ].includes(component.type);
}

function supportsDateBehavior(component: AuthoringComponent) {
  return ['date', 'dateRange', 'memorableDate', 'timePicker'].includes(component.type);
}

function supportsValidationConfig(component: AuthoringComponent) {
  return hasAnswerValue(component);
}

function supportsLengthValidation(component: AuthoringComponent) {
  return [
    'textInput',
    'email',
    'phone',
    'search',
    'inputGroup',
    'maskedInput',
    'textArea',
    'characterCount',
  ].includes(component.type);
}

function supportsRangeValidation(component: AuthoringComponent) {
  return (
    component.type === 'rangeSlider' ||
    (['textInput', 'inputGroup'].includes(component.type) &&
      ['number', 'range'].includes(String(component.inputType || '')))
  );
}

function supportsPatternValidation(component: AuthoringComponent) {
  return [
    'textInput',
    'email',
    'phone',
    'search',
    'inputGroup',
    'maskedInput',
    'textArea',
    'characterCount',
  ].includes(component.type);
}

function componentErrorMessages(component: AuthoringComponent) {
  return component.errorMessages && typeof component.errorMessages === 'object'
    ? (component.errorMessages as Record<string, string>)
    : {};
}

function errorMessagePatch(
  component: AuthoringComponent,
  key: string,
  message: string,
): Partial<AuthoringComponent> {
  const next = { ...componentErrorMessages(component) };
  if (message.trim()) {
    next[key] = message;
  } else {
    delete next[key];
  }

  return {
    errorMessages: Object.keys(next).length ? next : undefined,
  };
}

function FieldText({
  id,
  label,
  value,
  onChange,
  hint,
  readOnly,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="usa-label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span className="usa-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <input
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="usa-input"
        id={id}
        readOnly={readOnly}
        value={textValue(value)}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function FieldNumber({
  id,
  label,
  value,
  onChange,
  min,
  step,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: number | undefined) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="usa-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="usa-input"
        id={id}
        min={min}
        step={step}
        type="number"
        value={textValue(value)}
        onChange={event =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
      />
    </div>
  );
}

function FieldSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: unknown;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="usa-label" htmlFor={id}>
        {label}
      </label>
      <select
        className="usa-select"
        id={id}
        value={textValue(value)}
        onChange={event => onChange(event.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
  hint,
  code,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  hint?: string;
  code?: boolean;
}) {
  return (
    <div>
      <label className="usa-label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span className="usa-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <textarea
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`usa-textarea ${code ? 'builder-code-input' : ''}`}
        id={id}
        value={textValue(value)}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function FieldToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="usa-checkbox builder-checkbox">
      <input
        className="usa-checkbox__input"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      <label className="usa-checkbox__label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}

export function InspectorPanel({
  component,
  availableFields,
  onChange,
  onRemove,
  onAcceptComponent,
  onRejectComponent,
}: InspectorPanelProps) {
  if (!component) {
    return (
      <section className="builder-card builder-card--compact" aria-labelledby="inspector-heading">
        <div className="builder-card__header">
          <p className="builder-eyebrow">Properties</p>
          <h2 id="inspector-heading">No field selected</h2>
        </div>
        <p className="usa-prose">Select a field to edit its content and behavior.</p>
      </section>
    );
  }

  const support = getComponentSystemSupport(component.type);
  const hasOptions = ['radioButton', 'select', 'checkbox', 'comboBox'].includes(component.type);
  const canAnswer = hasAnswerValue(component);
  const guidance = showLowConfidenceGuidance(component)
    ? buildConfidenceInsight(component.provenance)
    : null;
  const change = (patch: Partial<AuthoringComponent>) => onChange({ ...component, ...patch });

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="inspector-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Properties</p>
          <h2 id="inspector-heading">{component.label}</h2>
          {component.provenance && (
            <ConfidenceBadge
              provenance={component.provenance}
              componentId={component.id}
              onAccept={onAcceptComponent}
              onReject={onRejectComponent}
            />
          )}
          {guidance && (
            <section className="builder-confidence-guidance" aria-label="Why review this field">
              <p className="builder-eyebrow">Why review this?</p>
              <p>{guidance.summary}</p>
              <ul>
                {guidance.checks.map(check => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <button className="usa-button usa-button--secondary" type="button" onClick={onRemove}>
          Remove
        </button>
      </div>

      <FieldText
        id="field-label"
        label={
          component.type === 'tag'
            ? 'Tag text'
            : component.type === 'button'
              ? 'Button label'
              : 'Label'
        }
        value={component.label}
        onChange={label => change({ label })}
      />

      <div className="builder-two-column">
        <FieldText id="field-id" label="Field ID" value={component.id} onChange={id => change({ id })} />
        <FieldText id="field-type" label="Type" value={component.type} readOnly onChange={() => undefined} />
      </div>

      {component.type === 'sectionGroup' ? (
        <FieldTextarea
          id="field-description"
          label="Section description"
          value={component.description}
          onChange={description => change({ description })}
        />
      ) : (
        canAnswer && (
          <FieldTextarea
            id="field-hint"
            label="Hint"
            value={component.hint}
            onChange={hint => change({ hint })}
          />
        )
      )}

      {component.type === 'sectionGroup' && (
        <div className="builder-support">
          <p className="builder-eyebrow">Section contents</p>
          <div className="builder-support__grid">
            <span>Components</span>
            <strong>{component.children?.length || 0}</strong>
          </div>
        </div>
      )}

      {hasOptions && (
        <InspectorSection defaultOpen title="Choices">
          <FieldTextarea
            id="field-options"
            label="Options"
            hint="One option per line. Use value|Label."
            value={optionsToText(component)}
            code
            onChange={value => change({ responseOptions: textToOptions(value) })}
          />
        </InspectorSection>
      )}

      {supportsTextBehavior(component) && (
        <InspectorSection defaultOpen title="Input behavior">
          {component.type !== 'textArea' && component.type !== 'characterCount' && (
            <FieldSelect
              id="field-input-type"
              label="Input type"
              value={
                component.inputType ||
                (component.type === 'email'
                  ? 'email'
                  : component.type === 'phone'
                    ? 'tel'
                    : component.type === 'search'
                      ? 'search'
                      : 'text')
              }
              options={[
                { value: 'text', label: 'Text' },
                { value: 'email', label: 'Email' },
                { value: 'tel', label: 'Phone' },
                { value: 'number', label: 'Number' },
                { value: 'url', label: 'URL' },
                { value: 'search', label: 'Search' },
                { value: 'password', label: 'Password' },
              ]}
              onChange={inputType => change({ inputType })}
            />
          )}
          <div className="builder-two-column">
            <FieldText
              id="field-placeholder"
              label="Placeholder"
              value={component.placeholder}
              onChange={placeholder => change({ placeholder })}
            />
            <FieldText
              id="field-autocomplete"
              label="Autocomplete"
              value={component.autocomplete}
              onChange={autocomplete => change({ autocomplete })}
            />
          </div>
          {component.type === 'inputGroup' && (
            <div className="builder-two-column">
              <FieldText id="field-prefix" label="Prefix" value={component.prefix} onChange={prefix => change({ prefix })} />
              <FieldText id="field-suffix" label="Suffix" value={component.suffix} onChange={suffix => change({ suffix })} />
            </div>
          )}
          {component.type === 'maskedInput' && (
            <FieldToggle
              id="field-allow-reveal"
              label="Allow show/hide value control"
              checked={component.allowReveal !== false}
              onChange={allowReveal => change({ allowReveal })}
            />
          )}
        </InspectorSection>
      )}

      {supportsDateBehavior(component) && (
        <InspectorSection title="Date and time">
          {component.type === 'dateRange' && (
            <>
              <div className="builder-two-column">
                <FieldText
                  id="date-range-start-label"
                  label="Start label"
                  value={component.startLabel}
                  onChange={startLabel => change({ startLabel })}
                />
                <FieldText
                  id="date-range-end-label"
                  label="End label"
                  value={component.endLabel}
                  onChange={endLabel => change({ endLabel })}
                />
              </div>
              <div className="builder-two-column">
                <FieldText
                  id="date-range-start-hint"
                  label="Start hint"
                  value={component.startHint}
                  onChange={startHint => change({ startHint })}
                />
                <FieldText
                  id="date-range-end-hint"
                  label="End hint"
                  value={component.endHint}
                  onChange={endHint => change({ endHint })}
                />
              </div>
              <FieldToggle
                id="date-range-allow-future"
                label="Allow future dates"
                checked={Boolean(component.allowFutureDates)}
                onChange={allowFutureDates => change({ allowFutureDates })}
              />
            </>
          )}
          <div className="builder-two-column">
            <FieldText
              id="field-min-date"
              label="Minimum"
              value={component.minimum}
              hint="Use ISO dates when applicable, such as 2026-04-24."
              onChange={minimum => change({ minimum })}
            />
            <FieldText id="field-max-date" label="Maximum" value={component.maximum} onChange={maximum => change({ maximum })} />
          </div>
          {component.type !== 'timePicker' && (
            <FieldSelect
              id="field-date-format"
              label="Display format"
              value={component.dateFormat || 'month-day-year'}
              options={[
                { value: 'month-day-year', label: 'Month / day / year' },
                { value: 'month-year', label: 'Month / year' },
                { value: 'year', label: 'Year only' },
              ]}
              onChange={dateFormat => change({ dateFormat })}
            />
          )}
        </InspectorSection>
      )}

      {component.type === 'rangeSlider' && (
        <InspectorSection defaultOpen title="Range">
          <div className="builder-two-column">
            <FieldNumber id="field-range-min" label="Minimum" value={component.minimum} onChange={minimum => change({ minimum })} />
            <FieldNumber id="field-range-max" label="Maximum" value={component.maximum} onChange={maximum => change({ maximum })} />
          </div>
          <FieldNumber
            id="field-range-step"
            label="Step"
            min={0}
            step={0.01}
            value={component.step || 1}
            onChange={step => change({ step })}
          />
        </InspectorSection>
      )}

      {component.type === 'fileUpload' && (
        <InspectorSection defaultOpen title="Upload">
          <FieldToggle
            id="file-multiple"
            label="Allow multiple files"
            checked={Boolean(component.multiple)}
            onChange={multiple => change({ multiple })}
          />
          <div className="builder-two-column">
            <FieldNumber
              id="max-file-count"
              label="Max files"
              min={1}
              value={component.maxFileCount || 1}
              onChange={maxFileCount => change({ maxFileCount: Math.max(1, maxFileCount || 1) })}
            />
            <FieldNumber
              id="max-file-size"
              label="Max file size MB"
              min={0}
              value={component.maxFileSize}
              onChange={maxFileSize => change({ maxFileSize })}
            />
          </div>
          <FieldText
            id="file-accept"
            label="Accepted file types"
            hint="Comma-separated extensions or MIME types, such as .pdf, .jpg."
            value={arrayToCsv(component.accept)}
            onChange={accept => change({ accept: csvToArray(accept) })}
          />
          <FieldText id="file-endpoint" label="Upload endpoint" value={component.endpoint} onChange={endpoint => change({ endpoint })} />
        </InspectorSection>
      )}

      {['alert', 'summaryBox', 'accordion', 'card', 'prose'].includes(component.type) && (
        <InspectorSection defaultOpen title="Content">
          {component.type === 'alert' && (
            <FieldSelect
              id="alert-type"
              label="Alert type"
              value={component.alertType || 'info'}
              options={[
                { value: 'info', label: 'Information' },
                { value: 'warning', label: 'Warning' },
                { value: 'error', label: 'Error' },
                { value: 'success', label: 'Success' },
              ]}
              onChange={alertType => change({ alertType })}
            />
          )}
          <FieldTextarea
            id="content-description"
            label={component.type === 'prose' ? 'Body text' : 'Description'}
            value={component.description}
            onChange={description => change({ description })}
          />
          {component.type === 'accordion' && (
            <FieldToggle
              id="accordion-open"
              label="Open by default"
              checked={Boolean(component.defaultOpen)}
              onChange={defaultOpen => change({ defaultOpen })}
            />
          )}
        </InspectorSection>
      )}

      {component.type === 'table' && (
        <InspectorSection defaultOpen title="Table">
          <FieldToggle
            id="table-header-row"
            label="Use first row as table header"
            checked={component.headerRow !== false}
            onChange={headerRow => change({ headerRow })}
          />
          <FieldTextarea
            id="table-rows"
            label="Rows"
            hint="One row per line. Separate cells with |."
            value={tableToText(component.rows)}
            code
            onChange={rows => change({ rows: textToTable(rows) })}
          />
        </InspectorSection>
      )}

      {component.type === 'processList' && (
        <InspectorSection defaultOpen title="Process steps">
          <FieldTextarea
            id="process-items"
            label="Steps"
            hint="One step per line."
            value={arrayToLines(component.items, ['Step one', 'Step two'])}
            onChange={items => change({ items: linesToArray(items) })}
          />
        </InspectorSection>
      )}

      {component.type === 'button' && (
        <InspectorSection defaultOpen title="Action">
          <FieldSelect
            id="button-style"
            label="Style"
            value={component.buttonStyle || 'primary'}
            options={[
              { value: 'primary', label: 'Primary' },
              { value: 'secondary', label: 'Secondary' },
              { value: 'outline', label: 'Outline' },
            ]}
            onChange={buttonStyle => change({ buttonStyle })}
          />
          <FieldText id="button-url" label="Action URL" value={component.actionUrl} onChange={actionUrl => change({ actionUrl })} />
        </InspectorSection>
      )}

      {component.type === 'buttonGroup' && (
        <InspectorSection defaultOpen title="Actions">
          <div className="builder-two-column">
            <FieldText
              id="primary-label"
              label="Primary label"
              value={component.primaryLabel || 'Primary action'}
              onChange={primaryLabel => change({ primaryLabel })}
            />
            <FieldText
              id="secondary-label"
              label="Secondary label"
              value={component.secondaryLabel || 'Secondary action'}
              onChange={secondaryLabel => change({ secondaryLabel })}
            />
          </div>
        </InspectorSection>
      )}

      {supportsValidationConfig(component) && (
        <InspectorSection defaultOpen title="Validation">
          <FieldToggle
            id="field-required"
            label="Required by default"
            checked={Boolean(component.required)}
            onChange={required => change({ required })}
          />
          <ConditionEditor
            availableFields={availableFields}
            condition={component.requiredIf}
            label="Require this field when"
            onChange={requiredIf => change({ requiredIf })}
          />

          {supportsLengthValidation(component) && (
            <div className="builder-two-column">
              <FieldNumber
                id="validation-min-length"
                label="Min length"
                min={0}
                value={component.minLength}
                onChange={minLength => change({ minLength })}
              />
              <FieldNumber
                id="validation-max-length"
                label="Max length"
                min={0}
                value={component.maxLength}
                onChange={maxLength => change({ maxLength })}
              />
            </div>
          )}

          {supportsRangeValidation(component) && (
            <div className="builder-two-column">
              <FieldNumber
                id="validation-min"
                label="Minimum value"
                value={component.minimum}
                onChange={minimum => change({ minimum })}
              />
              <FieldNumber
                id="validation-max"
                label="Maximum value"
                value={component.maximum}
                onChange={maximum => change({ maximum })}
              />
            </div>
          )}

          {supportsPatternValidation(component) && (
            <FieldText
              id="validation-pattern"
              label="Pattern"
              hint="Regular expression used by preview, runner, and generated validation."
              value={component.pattern}
              onChange={pattern => change({ pattern })}
            />
          )}

          <div className="builder-form-section">
            <h3>Constraint messages</h3>
            <p className="builder-muted">Leave blank to use the default VA message.</p>
            <FieldText
              id="validation-required-message"
              label="Required message"
              value={componentErrorMessages(component).required}
              onChange={message => change(errorMessagePatch(component, 'required', message))}
            />
            {supportsLengthValidation(component) && (
              <div className="builder-two-column">
                <FieldText
                  id="validation-min-length-message"
                  label="Min length message"
                  value={componentErrorMessages(component).minLength}
                  onChange={message => change(errorMessagePatch(component, 'minLength', message))}
                />
                <FieldText
                  id="validation-max-length-message"
                  label="Max length message"
                  value={componentErrorMessages(component).maxLength}
                  onChange={message => change(errorMessagePatch(component, 'maxLength', message))}
                />
              </div>
            )}
            {supportsRangeValidation(component) && (
              <div className="builder-two-column">
                <FieldText
                  id="validation-min-message"
                  label="Minimum message"
                  value={componentErrorMessages(component).minimum}
                  onChange={message => change(errorMessagePatch(component, 'minimum', message))}
                />
                <FieldText
                  id="validation-max-message"
                  label="Maximum message"
                  value={componentErrorMessages(component).maximum}
                  onChange={message => change(errorMessagePatch(component, 'maximum', message))}
                />
              </div>
            )}
            {supportsPatternValidation(component) && (
              <FieldText
                id="validation-pattern-message"
                label="Pattern message"
                value={componentErrorMessages(component).pattern}
                onChange={message => change(errorMessagePatch(component, 'pattern', message))}
              />
            )}
          </div>

          <FieldValidationsEditor
            availableFields={availableFields}
            component={component}
            onChange={validations => change({ validations })}
          />
        </InspectorSection>
      )}

      {canAnswer && (
        <InspectorSection eyebrow="Rules" title="Conditional behavior">
          <ConditionEditor
            availableFields={availableFields}
            condition={component.showIf}
            label="Show this field only when"
            onChange={showIf => change({ showIf })}
          />
        </InspectorSection>
      )}

      <EventHandlersEditor
        availableFields={availableFields}
        handlers={component.events}
        scopedComponentId={component.id}
        title="Component events"
        onChange={events => change({ events })}
      />

      <div className="builder-support">
        <p className="builder-eyebrow">Target support</p>
        <div className="builder-support__grid">
          <span>USWDS</span>
          <strong>{support.uswds?.component || 'Not mapped'}</strong>
          <span>Generated config</span>
          <strong>{support.vaFormsSystem?.component || 'Not mapped'}</strong>
          <span>shadcn</span>
          <strong>{support.shadcn?.component || 'Not mapped'}</strong>
        </div>
      </div>
    </section>
  );
}
