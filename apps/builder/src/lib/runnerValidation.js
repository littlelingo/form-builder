import { evaluateRule } from '../../../../src/index.mjs';
import {
  applyRunnerComputedValues,
  buildVisibleSteps,
  dataForStep,
  fieldValueForStep,
  isAnswerComponent,
  isComponentRequired,
  listItemsForChapter,
  visibleComponentsForPage,
} from './runnerFlow.js';

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') {
    return Object.values(value).some(hasValue);
  }
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function fieldKey(step, component) {
  if (step?.kind === 'listItemPage') {
    return `${step.arrayPath}.${step.itemIndex}.${component.id}`;
  }
  return component.id;
}

function dateIsSane(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(String(value));
}

function dateIsFuture(value) {
  return dateIsSane(value) && String(value) > new Date().toISOString().slice(0, 10);
}

function dateRangeParts(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function phoneIsSane(value) {
  return String(value).replace(/\D/g, '').length >= 10;
}

function emailIsSane(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

export function validateComponent(component, value, data, runtimeState = {}) {
  const errors = [];
  const runtime = runtimeState.components?.[component.id] || {};

  if (runtime.validationMessage) {
    errors.push(String(runtime.validationMessage));
  }

  if (!hasValue(value)) return errors;

  if (component.pattern) {
    try {
      if (!new RegExp(component.pattern).test(String(value))) {
        errors.push(component.errorMessages?.pattern || `${component.label} must match the required format.`);
      }
    } catch {
      errors.push(`${component.label} has an invalid validation pattern.`);
    }
  }

  if (component.minLength !== undefined && String(value).length < Number(component.minLength)) {
    errors.push(
      component.errorMessages?.minLength ||
        `${component.label} must be at least ${component.minLength} characters.`,
    );
  }

  if (component.maxLength !== undefined && String(value).length > Number(component.maxLength)) {
    errors.push(
      component.errorMessages?.maxLength ||
        `${component.label} must be ${component.maxLength} characters or fewer.`,
    );
  }

  if (component.minimum !== undefined && Number(value) < Number(component.minimum)) {
    errors.push(component.errorMessages?.minimum || `${component.label} must be ${component.minimum} or more.`);
  }

  if (component.maximum !== undefined && Number(value) > Number(component.maximum)) {
    errors.push(component.errorMessages?.maximum || `${component.label} must be ${component.maximum} or less.`);
  }

  if (component.type === 'email' && !emailIsSane(value)) {
    errors.push('Enter an email address in the format name@example.com.');
  }

  if (component.type === 'phone' && !phoneIsSane(value)) {
    errors.push('Enter a 10 digit phone number.');
  }

  if (component.type === 'date' && !dateIsSane(value)) {
    errors.push('Enter a valid date.');
  }

  if (component.type === 'dateRange') {
    const range = dateRangeParts(value);
    if (range.startDate && !dateIsSane(range.startDate)) {
      errors.push('Enter a valid start date.');
    }
    if (range.endDate && !dateIsSane(range.endDate)) {
      errors.push('Enter a valid end date.');
    }
    if (!component.allowFutureDates && dateIsFuture(range.startDate)) {
      errors.push('Enter a start date that is today or in the past.');
    }
    if (!component.allowFutureDates && dateIsFuture(range.endDate)) {
      errors.push('Enter an end date that is today or in the past.');
    }
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      errors.push('Enter an end date that is after the start date.');
    }
  }

  (component.validations || []).forEach(validation => {
    try {
      if (!evaluateRule(validation.rule, { ...(data || {}), $field: value })) {
        errors.push(validation.message);
      }
    } catch (error) {
      errors.push(`Validation could not run: ${error.message}`);
    }
  });

  return errors;
}

export function validateStep(step, data = {}, runtimeState = {}) {
  if (!step) return {};

  if (step.kind === 'formReview') {
    return {};
  }

  if (step.kind === 'listReview') {
    return validateListReviewStep(step, data, runtimeState);
  }

  const errors = {};
  const stepData = dataForStep(data, step);
  const warnings = [];
  const components = visibleComponentsForPage(step.page, stepData, runtimeState, warnings).filter(
    isAnswerComponent,
  );

  components.forEach(component => {
    const value = fieldValueForStep(data, step, component.id);
    const componentErrors = [];
    if (
      isComponentRequired(component, stepData, runtimeState, warnings) &&
      (component.type === 'dateRange'
        ? !dateRangeParts(value).startDate || !dateRangeParts(value).endDate
        : !hasValue(value))
    ) {
      componentErrors.push(component.errorMessages?.required || `${component.label} is required.`);
    }
    componentErrors.push(...validateComponent(component, value, stepData, runtimeState));
    if (componentErrors.length) errors[fieldKey(step, component)] = componentErrors;
  });

  return errors;
}

export function validateListReviewStep(step, data = {}, runtimeState = {}) {
  const errors = {};
  const items = listItemsForChapter(data, step.chapter);

  if (step.chapter.options?.required && items.length === 0) {
    errors[step.arrayPath] = [
      `Add at least one ${step.chapter.options?.nounSingular || 'item'} before continuing.`,
    ];
    return errors;
  }

  items.forEach((_, itemIndex) => {
    (step.chapter.pages || []).forEach(page => {
      const itemStep = {
        ...step,
        id: `list:${step.chapter.id}:${itemIndex}:${page.id}`,
        kind: 'listItemPage',
        page,
        pageId: page.id,
        itemIndex,
      };
      Object.assign(errors, validateStep(itemStep, data, runtimeState));
    });
  });

  return errors;
}

export function validateAllRunnerSteps(form, data = {}, runtimeState = {}) {
  const errors = {};
  const computedData = applyRunnerComputedValues(form, data);
  const { steps } = buildVisibleSteps(form, computedData, runtimeState, null);

  steps.forEach(step => {
    Object.assign(errors, validateStep(step, computedData, runtimeState));
  });

  return errors;
}
