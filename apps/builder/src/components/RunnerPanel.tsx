import { useEffect, useMemo, useRef } from 'react';

import { validateAuthoringForm } from '../lib/core';
import {
  appendListItem,
  buildReviewSections,
  buildSubmitPayload,
  buildVisibleSteps,
  dataForStep,
  fieldValueForStep,
  isComponentRequired,
  itemLabel,
  itemSummary,
  listItemsForChapter,
  removeListItem,
  setFieldValueForStep,
  visibleComponentsForPage,
} from '../lib/runnerFlow';
import { emptyRuntimeState, executeRunnerEvent } from '../lib/runnerRuntime';
import { validateAllRunnerSteps, validateStep } from '../lib/runnerValidation';
import type { AuthoringComponent, AuthoringForm, PreviewData } from '../types';

type SubmitStatus = 'ready' | 'submitting' | 'success' | 'validation-blocked';

interface SubmitResult {
  status: SubmitStatus;
  submitUrl: string;
  payload: PreviewData;
  computedData: PreviewData;
  computedValues?: Array<Record<string, unknown>>;
  trimmedFields?: Array<Record<string, unknown>>;
  validationErrors?: Array<Record<string, unknown>>;
  warnings?: Array<Record<string, unknown>>;
  submittedAt?: string;
}

export interface RunnerState {
  data: PreviewData;
  stepIndex: number;
  activeListItem: { chapterId: string; itemIndex: number } | null;
  visitedSteps: string[];
  errors: Record<string, string[]>;
  runtimeState: { components: Record<string, Record<string, unknown>> };
  eventLog: Array<Record<string, unknown>>;
  submitResult: SubmitResult | null;
}

interface RunnerPanelProps {
  form: AuthoringForm;
  state: RunnerState;
  onChange: (state: RunnerState) => void;
  onReset: () => void;
}

type RunnerStep = Record<string, any>;
type RunnerEventResult = {
  data: PreviewData;
  runtimeState: RunnerState['runtimeState'];
  eventLog: RunnerState['eventLog'];
};

const buildRunnerSteps = buildVisibleSteps as unknown as (
  form: AuthoringForm,
  data: PreviewData,
  runtimeState: RunnerState['runtimeState'],
  activeListItem: RunnerState['activeListItem'],
) => { steps: RunnerStep[]; computedData: PreviewData; warnings: RunnerState['eventLog'] };
const buildRunnerReviewSections = buildReviewSections as unknown as (
  form: AuthoringForm,
  data: PreviewData,
  runtimeState: RunnerState['runtimeState'],
) => { sections: RunnerStep[]; computedData: PreviewData; warnings: RunnerState['eventLog'] };

const executeEvent = executeRunnerEvent as unknown as (input: Record<string, unknown>) => RunnerEventResult;
const validateRunnerStep = validateStep as unknown as (
  step: RunnerStep,
  data: PreviewData,
  runtimeState: RunnerState['runtimeState'],
) => Record<string, string[]>;
const validateAllSteps = validateAllRunnerSteps as unknown as (
  form: AuthoringForm,
  data: PreviewData,
  runtimeState: RunnerState['runtimeState'],
) => Record<string, string[]>;
const emptyState = emptyRuntimeState as unknown as () => RunnerState['runtimeState'];

function fieldKey(step: Record<string, unknown>, component: AuthoringComponent) {
  if (step.kind === 'listItemPage') {
    return `${step.arrayPath}.${step.itemIndex}.${component.id}`;
  }
  return component.id;
}

function textValue(value: unknown) {
  return value === undefined || value === null ? '' : String(value);
}

function selectedValues(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function toggleArrayValue(value: unknown, option: string, checked: boolean) {
  const values = selectedValues(value);
  if (checked && !values.includes(option)) return [...values, option];
  if (!checked) return values.filter(item => item !== option);
  return values;
}

function optionValue(option: { value?: string; id?: string; label: string }) {
  return option.value || option.id || option.label;
}

function inputType(component: AuthoringComponent) {
  if (component.inputType) return component.inputType;
  if (component.type === 'email') return 'email';
  if (component.type === 'phone') return 'tel';
  if (component.type === 'date') return 'date';
  return 'text';
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

function errorList(errors: Record<string, string[]>) {
  return Object.entries(errors).flatMap(([key, messages]) =>
    messages.map(message => ({ key, message })),
  );
}

function hasErrors(errors: Record<string, string[]>) {
  return errorList(errors).length > 0;
}

function submitStatusText(status: SubmitStatus) {
  if (status === 'submitting') return 'Submitting';
  if (status === 'success') return 'Mock submitted';
  if (status === 'validation-blocked') return 'Validation blocked';
  return 'Ready to submit';
}

function submitStatusClass(status: SubmitStatus) {
  if (status === 'submitting') return 'is-submitting';
  if (status === 'success') return 'is-success';
  if (status === 'validation-blocked') return 'is-blocked';
  return 'is-ready';
}

function ReviewStep({
  form,
  data,
  runtimeState,
  submitResult,
  onEditItemPage,
  onEditStep,
}: {
  form: AuthoringForm;
  data: PreviewData;
  runtimeState: RunnerState['runtimeState'];
  submitResult: SubmitResult | null;
  onEditItemPage: (chapterId: string, itemIndex: number, pageId: string) => void;
  onEditStep: (chapterId: string, pageId: string) => void;
}) {
  const { sections } = buildRunnerReviewSections(form, data, runtimeState);
  const preview = buildSubmitPayload(form, data, runtimeState) as SubmitResult;
  const result: SubmitResult = submitResult || {
    ...preview,
    status: 'ready',
    submitUrl: form.submitUrl || '(no submitUrl configured)',
  };
  const computedValues = result.computedValues || preview.computedValues || [];
  const trimmedFields = result.trimmedFields || preview.trimmedFields || [];
  const validationErrors = result.validationErrors || [];

  return (
    <div className="runner-review">
      <section className="runner-submit-review runner-submit-review--status" aria-labelledby="runner-submit-status-heading">
        <div className="builder-card__header builder-card__header--split builder-card__header--compact">
          <div>
            <p className="builder-eyebrow">Review and submit</p>
            <h3 id="runner-submit-status-heading">Submit this mock form</h3>
            <p className="builder-muted">
              Review visible answers, computed data, and trimmed values before mock submit.
            </p>
          </div>
          <span aria-live="polite" className={`builder-status ${submitStatusClass(result.status)}`}>
            {submitStatusText(result.status)}
          </span>
        </div>

        {result.status === 'validation-blocked' && (
          <div className="usa-alert usa-alert--error builder-alert" role="alert">
            <div className="usa-alert__body">
              <h4 className="usa-alert__heading">Submit is blocked</h4>
              <p className="usa-alert__text">Fix validation issues before submitting this mock form.</p>
            </div>
          </div>
        )}
      </section>

      {sections.map(section => (
        <section className="runner-review-section" key={section.id}>
          <div className="builder-card__header builder-card__header--split builder-card__header--compact">
            <div>
              <h3>{section.title}</h3>
              {section.kind === 'listLoop' && (
                <p className="builder-muted">
                  {section.items.length} {section.chapter.options?.nounPlural || 'items'} added
                </p>
              )}
            </div>
          </div>

          {section.kind === 'listLoop' ? (
            <div className="runner-review-list">
              {section.items.length === 0 && (
                <p className="builder-muted">No {section.chapter.options?.nounPlural || 'items'} added.</p>
              )}
              {section.items.map((item: RunnerStep) => (
                <article className="runner-review-item" key={`${section.id}-${item.itemIndex}`}>
                  <div className="builder-card__header builder-card__header--split builder-card__header--compact">
                    <div>
                      <h4>{item.label}</h4>
                      {item.summary && <p className="builder-muted">{item.summary}</p>}
                    </div>
                  </div>
                  {item.pages.map((page: RunnerStep) => (
                    <div className="runner-review-page" key={`${item.itemIndex}-${page.id}`}>
                      <div className="runner-review-page__header">
                        <h5>{page.title}</h5>
                        <button
                          className="usa-button usa-button--unstyled"
                          type="button"
                          onClick={() => onEditItemPage(section.id, item.itemIndex, page.id)}
                        >
                          Edit
                        </button>
                      </div>
                      <dl className="runner-review-fields">
                        {page.fields.map((field: RunnerStep) => (
                          <div key={field.id}>
                            <dt>{field.label}</dt>
                            <dd>{field.displayValue}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            section.pages.map((page: RunnerStep) => (
              <div className="runner-review-page" key={page.id}>
                <div className="runner-review-page__header">
                  <h4>{page.title}</h4>
                  <button
                    className="usa-button usa-button--unstyled"
                    type="button"
                    onClick={() => onEditStep(section.id, page.id)}
                  >
                    Edit
                  </button>
                </div>
                <dl className="runner-review-fields">
                  {page.fields.map((field: RunnerStep) => (
                    <div key={field.id}>
                      <dt>{field.label}</dt>
                      <dd>{field.displayValue}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          )}
        </section>
      ))}

      <section className="runner-submit-review" aria-labelledby="runner-submit-review-heading">
          <div>
            <p className="builder-eyebrow">Mock submit</p>
            <h3 id="runner-submit-review-heading">Submission preview</h3>
            <p className="builder-muted">
              This is the payload after visible-field trimming. No backend request is sent.
            </p>
          </div>
          <div className="runner-submit-grid">
            <div>
              <h4>Status</h4>
              <p>{submitStatusText(result.status)}</p>
            </div>
            <div>
              <h4>Endpoint</h4>
              <p>{String(result.submitUrl || form.submitUrl || '(no submitUrl configured)')}</p>
            </div>
          </div>
          {validationErrors.length > 0 && (
            <div className="runner-submit-trimmed">
              <h4>Validation issues</h4>
              <ul>
                {validationErrors.map(error => (
                  <li key={`${String(error.key)}-${String(error.message)}`}>
                    {String(error.message)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="runner-submit-trimmed">
            <h4>Trimmed values</h4>
            {trimmedFields.length ? (
              <ul>
                {trimmedFields.map(field => (
                  <li key={String(field.path)}>
                    <strong>{String(field.label)}</strong>
                    <span>
                      {String(field.displayValue)} ({String(field.path)})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="builder-muted">No hidden answered fields were trimmed.</p>
            )}
          </div>
          <div className="runner-submit-trimmed">
            <h4>Computed values</h4>
            {computedValues.length ? (
              <ul>
                {computedValues.map(item => (
                  <li key={String(item.id || item.target)}>
                    <strong>{String(item.target)}</strong>
                    <span>{String(item.displayValue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="builder-muted">No computed values are configured.</p>
            )}
          </div>
          <div className="runner-submit-output">
            <div>
              <h4>Payload</h4>
              <pre className="builder-code-block builder-code-block--small">
                {JSON.stringify(result.payload || {}, null, 2)}
              </pre>
            </div>
            <div>
              <h4>Computed data</h4>
              <pre className="builder-code-block builder-code-block--small">
                {JSON.stringify(result.computedData || preview.computedData || {}, null, 2)}
              </pre>
            </div>
          </div>
        </section>
    </div>
  );
}

function RunnerField({
  component,
  errorMessages,
  required,
  step,
  value,
  onBlur,
  onChange,
  onFocus,
}: {
  component: AuthoringComponent;
  errorMessages: string[];
  required: boolean;
  step: Record<string, unknown>;
  value: unknown;
  onBlur: () => void;
  onChange: (value: unknown) => void;
  onFocus: () => void;
}) {
  const id = `runner-${String(step.id)}-${component.id}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [
    component.hint ? hintId : '',
    errorMessages.length ? errorId : '',
  ].filter(Boolean).join(' ') || undefined;
  const invalid = errorMessages.length > 0;

  if (component.type === 'radioButton' || component.type === 'yesNo') {
    const options =
      component.type === 'yesNo'
        ? [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]
        : component.responseOptions || [];

    return (
      <fieldset className={`usa-fieldset runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <legend className="usa-legend">
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </legend>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        {options.map(option => {
          const actualValue = optionValue(option);
          return (
            <div className="usa-radio" key={actualValue}>
              <input
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                checked={textValue(value) === actualValue}
                className="usa-radio__input"
                id={`${id}-${actualValue}`}
                name={id}
                type="radio"
                onBlur={onBlur}
                onChange={() => onChange(component.type === 'yesNo' ? option.value === 'true' : actualValue)}
                onFocus={onFocus}
              />
              <label className="usa-radio__label" htmlFor={`${id}-${actualValue}`}>
                {option.label}
              </label>
            </div>
          );
        })}
      </fieldset>
    );
  }

  if (component.type === 'checkbox') {
    return (
      <fieldset className={`usa-fieldset runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <legend className="usa-legend">
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </legend>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        {(component.responseOptions || []).map(option => {
          const actualValue = optionValue(option);
          return (
            <div className="usa-checkbox" key={actualValue}>
              <input
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                checked={selectedValues(value).includes(actualValue)}
                className="usa-checkbox__input"
                id={`${id}-${actualValue}`}
                type="checkbox"
                onBlur={onBlur}
                onChange={event => onChange(toggleArrayValue(value, actualValue, event.target.checked))}
                onFocus={onFocus}
              />
              <label className="usa-checkbox__label" htmlFor={`${id}-${actualValue}`}>
                {option.label}
              </label>
            </div>
          );
        })}
      </fieldset>
    );
  }

  if (component.type === 'select' || component.type === 'comboBox') {
    return (
      <div className={`usa-form-group runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <label className="usa-label" htmlFor={id}>
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </label>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        <select
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="usa-select"
          id={id}
          value={textValue(value)}
          onBlur={onBlur}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
        >
          <option value="">- Select -</option>
          {(component.responseOptions || []).map(option => (
            <option key={optionValue(option)} value={optionValue(option)}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (component.type === 'address') {
    const address = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    const updateAddress = (property: string, nextValue: string) => {
      onChange({ ...address, [property]: nextValue });
    };

    return (
      <fieldset className={`usa-fieldset runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <legend className="usa-legend">
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </legend>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        {[
          ['street', 'Street address'],
          ['city', 'City'],
          ['state', 'State'],
          ['postalCode', 'ZIP code'],
        ].map(([property, label]) => (
          <label className="runner-inline-label" htmlFor={`${id}-${property}`} key={property}>
            <span>{label}</span>
            <input
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="usa-input"
              id={`${id}-${property}`}
              value={textValue(address[property])}
              onBlur={onBlur}
              onChange={event => updateAddress(property, event.target.value)}
              onFocus={onFocus}
            />
          </label>
        ))}
      </fieldset>
    );
  }

  if (component.type === 'memorableDate') {
    const parts = memorableDateParts(value);
    return (
      <fieldset className={`usa-fieldset runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <legend className="usa-legend">
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </legend>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        <div className="builder-three-column">
          {[
            ['month', 'Month', 'MM', parts.month, 2],
            ['day', 'Day', 'DD', parts.day, 2],
            ['year', 'Year', 'YYYY', parts.year, 4],
          ].map(([part, label, placeholder, partValue, maxLength]) => (
            <label className="runner-inline-label" htmlFor={`${id}-${part}`} key={part}>
              <span>{label}</span>
              <input
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="usa-input"
                id={`${id}-${part}`}
                inputMode="numeric"
                maxLength={Number(maxLength)}
                placeholder={String(placeholder)}
                value={String(partValue)}
                onBlur={onBlur}
                onChange={event =>
                  onChange(
                    updateMemorableDatePart(value, part as 'day' | 'month' | 'year', event.target.value),
                  )
                }
                onFocus={onFocus}
              />
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (component.type === 'dateRange') {
    const parts = dateRangeParts(value);
    return (
      <fieldset className={`usa-fieldset runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <legend className="usa-legend">
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </legend>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        <div className="builder-two-column">
          {[
            ['startDate', textValue(component.startLabel) || 'Start date', parts.startDate],
            ['endDate', textValue(component.endLabel) || 'End date', parts.endDate],
          ].map(([part, label, partValue]) => (
            <label className="runner-inline-label" htmlFor={`${id}-${part}`} key={part}>
              <span>{label}</span>
              <input
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="usa-input"
                id={`${id}-${part}`}
                type="date"
                value={textValue(partValue)}
                onBlur={onBlur}
                onChange={event =>
                  onChange(updateDateRangePart(value, part as 'startDate' | 'endDate', event.target.value))
                }
                onFocus={onFocus}
              />
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (component.type === 'textArea') {
    return (
      <div className={`usa-form-group runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <label className="usa-label" htmlFor={id}>
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </label>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        <textarea
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="usa-textarea"
          id={id}
          maxLength={component.maxLength ? Number(component.maxLength) : undefined}
          minLength={component.minLength ? Number(component.minLength) : undefined}
          value={textValue(value)}
          onBlur={onBlur}
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
        />
      </div>
    );
  }

  if (component.type === 'fileUpload') {
    return (
      <div className={`usa-form-group runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
        <label className="usa-label" htmlFor={id}>
          {component.label}
          {required && <span className="builder-required"> required</span>}
        </label>
        {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
        {errorMessages.length > 0 && (
          <span className="usa-error-message" id={errorId} role="alert">
            {errorMessages[0]}
          </span>
        )}
        <input
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="usa-file-input"
          id={id}
          multiple={Boolean(component.multiple)}
          type="file"
          onBlur={onBlur}
          onChange={event => onChange(Array.from(event.target.files || []).map(file => file.name))}
          onFocus={onFocus}
        />
        {selectedValues(value).length > 0 && (
          <p className="builder-preview__file-note">Selected: {selectedValues(value).join(', ')}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`usa-form-group runner-field ${invalid ? 'usa-form-group--error' : ''}`}>
      <label className="usa-label" htmlFor={id}>
        {component.label}
        {required && <span className="builder-required"> required</span>}
      </label>
      {component.hint && <span className="usa-hint" id={hintId}>{component.hint}</span>}
      {errorMessages.length > 0 && (
        <span className="usa-error-message" id={errorId} role="alert">
          {errorMessages[0]}
        </span>
      )}
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete={textValue(component.autocomplete)}
        className="usa-input"
        id={id}
        inputMode={component.type === 'phone' ? 'tel' : undefined}
        max={component.maximum ? String(component.maximum) : undefined}
        maxLength={component.maxLength ? Number(component.maxLength) : undefined}
        min={component.minimum ? String(component.minimum) : undefined}
        minLength={component.minLength ? Number(component.minLength) : undefined}
        pattern={textValue(component.pattern) || undefined}
        type={inputType(component)}
        value={textValue(value)}
        onBlur={onBlur}
        onChange={event =>
          onChange(component.type === 'phone' ? formatPhoneNumber(event.target.value) : event.target.value)
        }
        onFocus={onFocus}
      />
    </div>
  );
}

export function RunnerPanel({ form, state, onChange, onReset }: RunnerPanelProps) {
  const errorSummaryRef = useRef<HTMLDivElement | null>(null);
  const validation = useMemo(() => validateAuthoringForm(form), [form]);
  const { steps, computedData, warnings } = useMemo(
    () => buildRunnerSteps(form, state.data, state.runtimeState, state.activeListItem),
    [form, state.activeListItem, state.data, state.runtimeState],
  );
  const currentStep = steps[Math.min(state.stepIndex, Math.max(steps.length - 1, 0))];
  const stepData = dataForStep(computedData, currentStep);
  const stepErrors = errorList(state.errors);
  const isReviewStep = currentStep?.kind === 'formReview';

  function updateState(patch: Partial<RunnerState>) {
    onChange({ ...state, ...patch });
  }

  function runEvent(eventName: string, payload: Record<string, unknown>, nextData = state.data) {
    const result = executeEvent({
      form,
      data: nextData,
      runtimeState: state.runtimeState || emptyState(),
      eventLog: state.eventLog || [],
      eventName,
      payload,
      step: currentStep,
    });
    updateState({
      data: result.data,
      runtimeState: result.runtimeState,
      eventLog: result.eventLog,
      submitResult: null,
    });
    return result;
  }

  useEffect(() => {
    if (!currentStep || state.visitedSteps.includes(currentStep.id)) return;
    if (currentStep.kind === 'formReview') return;
    const result = executeEvent({
      form,
      data: state.data,
      runtimeState: state.runtimeState || emptyState(),
      eventLog: state.eventLog || [],
      eventName: 'page.enter',
      payload: { pageId: currentStep.pageId, chapterId: currentStep.chapterId },
      step: currentStep,
    });
    onChange({
      ...state,
      data: result.data,
      runtimeState: result.runtimeState,
      eventLog: result.eventLog,
      visitedSteps: [...state.visitedSteps, currentStep.id],
    });
  }, [currentStep?.id]);

  useEffect(() => {
    if (stepErrors.length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [stepErrors.length, currentStep?.id]);

  function handleFieldChange(component: AuthoringComponent, value: unknown) {
    const nextData = setFieldValueForStep(state.data, currentStep, component.id, value);
    const result = executeEvent({
      form,
      data: nextData,
      runtimeState: state.runtimeState || emptyState(),
      eventLog: state.eventLog || [],
      eventName: 'field.change',
      payload: { componentId: component.id, value },
      step: currentStep,
    });
    onChange({
      ...state,
      data: result.data,
      runtimeState: result.runtimeState,
      eventLog: result.eventLog,
      errors: { ...state.errors, [fieldKey(currentStep, component)]: [] },
      submitResult: null,
    });
  }

  function handleContinue() {
    const errors = validateRunnerStep(currentStep, computedData, state.runtimeState);
    if (hasErrors(errors)) {
      updateState({ errors });
      return;
    }

    if (currentStep.kind === 'listItemPage') {
      let lastItemStepIndex = -1;
      steps.forEach((step, index) => {
        if (step.kind === 'listItemPage' && step.chapterId === currentStep.chapterId) {
          lastItemStepIndex = index;
        }
      });
      if (state.stepIndex >= lastItemStepIndex) {
        const reviewIndex = steps.findIndex(step => step.id === `list:${currentStep.chapterId}:review`);
        updateState({
          activeListItem: null,
          errors: {} as Record<string, string[]>,
          stepIndex: reviewIndex === -1 ? state.stepIndex : reviewIndex,
          submitResult: null,
        });
        return;
      }
    }

    updateState({
      errors: {} as Record<string, string[]>,
      stepIndex: Math.min(state.stepIndex + 1, Math.max(steps.length - 1, 0)),
      submitResult: null,
    });
  }

  function handleEditStep(chapterId: string, pageId: string) {
    const nextStepIndex = steps.findIndex(
      step => step.kind === 'page' && step.chapterId === chapterId && step.pageId === pageId,
    );
    updateState({
      activeListItem: null,
      errors: {} as Record<string, string[]>,
      stepIndex: nextStepIndex === -1 ? state.stepIndex : nextStepIndex,
      submitResult: null,
    });
  }

  function handleEditItemPage(chapterId: string, itemIndex: number, pageId: string) {
    const reviewIndex = steps.findIndex(step => step.id === `list:${chapterId}:review`);
    const chapter = form.chapters.find(item => item.id === chapterId);
    const pageOffset = chapter?.pages.findIndex(page => page.id === pageId) ?? 0;
    updateState({
      activeListItem: { chapterId, itemIndex },
      errors: {} as Record<string, string[]>,
      stepIndex: reviewIndex === -1 ? state.stepIndex : reviewIndex + Math.max(pageOffset, 0) + 1,
      submitResult: null,
    });
  }

  function handleBack() {
    updateState({
      errors: {} as Record<string, string[]>,
      stepIndex: Math.max(state.stepIndex - 1, 0),
      submitResult: null,
    });
  }

  function handleSubmit() {
    const beforeSubmit = executeEvent({
      form,
      data: state.data,
      runtimeState: state.runtimeState || emptyState(),
      eventLog: state.eventLog || [],
      eventName: 'form.beforeSubmit',
      payload: {},
      step: currentStep,
    });
    const errors = validateAllSteps(form, beforeSubmit.data, beforeSubmit.runtimeState);
    if (hasErrors(errors)) {
      const blockedOutput = buildSubmitPayload(
        form,
        beforeSubmit.data,
        beforeSubmit.runtimeState,
      ) as SubmitResult;
      onChange({
        ...state,
        data: beforeSubmit.data,
        runtimeState: beforeSubmit.runtimeState,
        eventLog: beforeSubmit.eventLog,
        errors,
        submitResult: {
          ...blockedOutput,
          status: 'validation-blocked',
          submitUrl: form.submitUrl || '(no submitUrl configured)',
          validationErrors: errorList(errors),
        },
      });
      return;
    }

    const submitted = executeEvent({
      form,
      data: beforeSubmit.data,
      runtimeState: beforeSubmit.runtimeState,
      eventLog: beforeSubmit.eventLog,
      eventName: 'form.submit',
      payload: {},
      step: currentStep,
    });
    const submitOutput = buildSubmitPayload(form, submitted.data, submitted.runtimeState);
    const submittingResult: SubmitResult = {
      ...(submitOutput as SubmitResult),
      status: 'submitting',
      submitUrl: form.submitUrl || '(no submitUrl configured)',
    };
    onChange({
      ...state,
      data: submitted.data,
      runtimeState: submitted.runtimeState,
      eventLog: submitted.eventLog,
      errors: {} as Record<string, string[]>,
      submitResult: submittingResult,
    });
    window.setTimeout(() => {
      onChange({
        ...state,
        data: submitted.data,
        runtimeState: submitted.runtimeState,
        eventLog: submitted.eventLog,
        errors: {} as Record<string, string[]>,
        submitResult: {
          ...submittingResult,
          status: 'success',
          submittedAt: new Date().toISOString(),
        },
      });
    }, 300);
  }

  function handleAddItem() {
    const result = appendListItem(state.data, currentStep.chapter);
    const reviewIndex = steps.findIndex(step => step.id === currentStep.id);
    updateState({
      data: result.data,
      activeListItem: { chapterId: currentStep.chapterId, itemIndex: result.itemIndex },
      stepIndex: reviewIndex + 1,
      errors: {} as Record<string, string[]>,
      submitResult: null,
    });
  }

  function handleEditItem(itemIndex: number) {
    const reviewIndex = steps.findIndex(step => step.id === currentStep.id);
    updateState({
      activeListItem: { chapterId: currentStep.chapterId, itemIndex },
      stepIndex: reviewIndex + 1,
      errors: {} as Record<string, string[]>,
      submitResult: null,
    });
  }

  function handleRemoveItem(itemIndex: number) {
    updateState({
      data: removeListItem(state.data, currentStep.chapter, itemIndex),
      activeListItem: null,
      errors: {} as Record<string, string[]>,
      submitResult: null,
    });
  }

  function listItemErrorCount(step: RunnerStep, itemIndex: number) {
    const prefix = `${step.arrayPath}.${itemIndex}.`;
    return Object.entries(state.errors)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((count, [, messages]) => count + messages.length, 0);
  }

  if (!validation.valid) {
    return (
      <section className="builder-card runner-panel" aria-labelledby="runner-heading">
        <div className="builder-card__header">
          <p className="builder-eyebrow">Run</p>
          <h2 id="runner-heading">Runner unavailable</h2>
        </div>
        <div className="usa-alert usa-alert--error builder-alert" role="alert">
          <div className="usa-alert__body">
            <p className="usa-alert__text">Fix authoring validation errors before running this form.</p>
          </div>
        </div>
        <pre className="builder-code-block builder-code-block--small">
          {JSON.stringify(validation.errors, null, 2)}
        </pre>
      </section>
    );
  }

  return (
    <section className="builder-card runner-panel" aria-labelledby="runner-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Run</p>
          <h2 id="runner-heading">{currentStep?.title || 'No visible screens'}</h2>
        </div>
        <div className="runner-progress" aria-label="Runner progress">
          {steps.length > 0 ? `${Math.min(state.stepIndex + 1, steps.length)} of ${steps.length}` : '0 of 0'}
        </div>
      </div>

      {steps.length === 0 && (
        <div className="builder-empty-canvas">No visible wizard steps match the current runner data.</div>
      )}

      {currentStep && (
        <div className="runner-layout">
          <div className="runner-wizard">
            {currentStep.bodyText && <p className="builder-preview__body">{String(currentStep.bodyText)}</p>}

            {stepErrors.length > 0 && (
              <div
                className="usa-alert usa-alert--error builder-alert"
                ref={errorSummaryRef}
                tabIndex={-1}
                aria-live="polite"
              >
                <div className="usa-alert__body">
                  <h3 className="usa-alert__heading">Review these issues</h3>
                  <ul className="runner-error-list">
                    {stepErrors.map(error => (
                      <li key={`${error.key}-${error.message}`}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {currentStep.kind === 'formReview' ? (
              <ReviewStep
                data={state.data}
                form={form}
                runtimeState={state.runtimeState}
                submitResult={state.submitResult}
                onEditItemPage={handleEditItemPage}
                onEditStep={handleEditStep}
              />
            ) : currentStep.kind === 'listReview' ? (
              <div className="runner-list-review">
                <div className="builder-card__header builder-card__header--split">
                  <div>
                    <h3>{currentStep.chapter.options?.nounPlural || 'Items'}</h3>
                    <p className="builder-muted">
                      {listItemsForChapter(state.data, currentStep.chapter).length} added
                    </p>
                  </div>
                  <button className="usa-button" type="button" onClick={handleAddItem}>
                    Add {currentStep.chapter.options?.nounSingular || 'item'}
                  </button>
                </div>
                <div className="runner-list-items">
                  {listItemsForChapter(state.data, currentStep.chapter).map((item: Record<string, unknown>, index: number) => (
                    <div className="runner-list-item" key={`${currentStep.chapterId}-${index}`}>
                      <div>
                        <strong>{itemLabel(currentStep.chapter, item, index)}</strong>
                        {itemSummary(currentStep.chapter, item) && (
                          <p className="builder-muted">{itemSummary(currentStep.chapter, item)}</p>
                        )}
                        {listItemErrorCount(currentStep, index) > 0 && (
                          <p className="runner-list-item__error">
                            {listItemErrorCount(currentStep, index)} issue
                            {listItemErrorCount(currentStep, index) === 1 ? '' : 's'} to fix
                          </p>
                        )}
                      </div>
                      <div className="runner-list-item__actions">
                        <button className="usa-button usa-button--secondary" type="button" onClick={() => handleEditItem(index)}>
                          Edit
                        </button>
                        <button className="usa-button usa-button--unstyled builder-remove-link" type="button" onClick={() => handleRemoveItem(index)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {listItemsForChapter(state.data, currentStep.chapter).length === 0 && (
                    <p className="builder-muted">No {currentStep.chapter.options?.nounPlural || 'items'} added.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="runner-fields">
                {visibleComponentsForPage(currentStep.page, stepData, state.runtimeState).map((component: AuthoringComponent) => {
                  const key = fieldKey(currentStep, component);
                  return (
                    <RunnerField
                      component={component}
                      errorMessages={state.errors[key] || []}
                      key={component.id}
                      required={isComponentRequired(component, stepData, state.runtimeState)}
                      step={currentStep}
                      value={fieldValueForStep(state.data, currentStep, component.id)}
                      onBlur={() => runEvent('field.blur', { componentId: component.id, value: fieldValueForStep(state.data, currentStep, component.id) })}
                      onChange={value => handleFieldChange(component, value)}
                      onFocus={() => runEvent('field.focus', { componentId: component.id, value: fieldValueForStep(state.data, currentStep, component.id) })}
                    />
                  );
                })}
              </div>
            )}

            <div className="runner-actions">
              <button className="usa-button usa-button--outline" disabled={state.stepIndex === 0} type="button" onClick={handleBack}>
                Back
              </button>
              <button className="usa-button usa-button--secondary" disabled type="button" title="Save in progress is not wired in this MVP">
                Save progress
              </button>
              {isReviewStep ? (
                <button
                  className="usa-button"
                  disabled={state.submitResult?.status === 'submitting'}
                  type="button"
                  onClick={handleSubmit}
                >
                  {state.submitResult?.status === 'submitting'
                    ? 'Submitting'
                    : state.submitResult?.status === 'success'
                      ? 'Submit again'
                      : 'Submit'}
                </button>
              ) : (
                <button className="usa-button" type="button" onClick={handleContinue}>
                  Continue
                </button>
              )}
              <button className="usa-button usa-button--unstyled" type="button" onClick={onReset}>
                Reset run
              </button>
            </div>
          </div>

          <aside className="runner-debug" aria-label="Runner debug panel">
            <div>
              <h3>Visible steps</h3>
              <ol>
                {steps.map((step, index) => (
                  <li className={index === state.stepIndex ? 'is-active' : ''} key={step.id}>
                    {step.title}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3>Runner data</h3>
              <pre className="builder-code-block builder-code-block--small">
                {JSON.stringify(computedData, null, 2)}
              </pre>
            </div>
            <div>
              <h3>Runtime state</h3>
              <pre className="builder-code-block builder-code-block--small">
                {JSON.stringify(state.runtimeState, null, 2)}
              </pre>
            </div>
            <div>
              <h3>Event log</h3>
              <pre className="builder-code-block builder-code-block--small">
                {JSON.stringify([...(state.eventLog || []), ...warnings].slice(-40), null, 2)}
              </pre>
            </div>
            <div>
              <h3>Mock submit</h3>
              <pre className="builder-code-block builder-code-block--small">
                {JSON.stringify(state.submitResult || {}, null, 2)}
              </pre>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
