const FIELD_OPERATORS = new Set([
  'equals',
  'notEquals',
  'in',
  'notIn',
  'exists',
  'notExists',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

export function getPathValue(data, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .reduce((current, segment) => {
      if (current === null || current === undefined) return undefined;
      return current[segment];
    }, data);
}

export function validateRule(rule, path = 'rule') {
  const errors = [];

  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return [`${path} must be an object`];
  }

  if ('all' in rule) {
    if (!Array.isArray(rule.all) || rule.all.length === 0) {
      errors.push(`${path}.all must be a non-empty array`);
    } else {
      rule.all.forEach((child, index) => {
        errors.push(...validateRule(child, `${path}.all[${index}]`));
      });
    }
  }

  if ('any' in rule) {
    if (!Array.isArray(rule.any) || rule.any.length === 0) {
      errors.push(`${path}.any must be a non-empty array`);
    } else {
      rule.any.forEach((child, index) => {
        errors.push(...validateRule(child, `${path}.any[${index}]`));
      });
    }
  }

  if ('not' in rule) {
    errors.push(...validateRule(rule.not, `${path}.not`));
  }

  if ('operator' in rule) {
    if (!FIELD_OPERATORS.has(rule.operator)) {
      errors.push(`${path}.operator "${rule.operator}" is not supported`);
    }
    if (!rule.field) {
      errors.push(`${path}.field is required`);
    }
    if (
      ['equals', 'notEquals', 'in', 'notIn', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual'].includes(
        rule.operator,
      ) &&
      !Object.prototype.hasOwnProperty.call(rule, 'value')
    ) {
      errors.push(`${path}.value is required for ${rule.operator}`);
    }
    if (['in', 'notIn'].includes(rule.operator) && !Array.isArray(rule.value)) {
      errors.push(`${path}.value must be an array for ${rule.operator}`);
    }
  }

  if (!('all' in rule) && !('any' in rule) && !('not' in rule) && !('operator' in rule)) {
    errors.push(`${path} must include all, any, not, or operator`);
  }

  return errors;
}

export function evaluateRule(rule, formData = {}) {
  const errors = validateRule(rule);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  if ('all' in rule) return rule.all.every(child => evaluateRule(child, formData));
  if ('any' in rule) return rule.any.some(child => evaluateRule(child, formData));
  if ('not' in rule) return !evaluateRule(rule.not, formData);

  const actual = getPathValue(formData, rule.field);

  switch (rule.operator) {
    case 'equals':
      return actual === rule.value;
    case 'notEquals':
      return actual !== rule.value;
    case 'in':
      return rule.value.includes(actual);
    case 'notIn':
      return !rule.value.includes(actual);
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'notExists':
      return actual === undefined || actual === null || actual === '';
    case 'greaterThan':
      return Number(actual) > Number(rule.value);
    case 'greaterThanOrEqual':
      return Number(actual) >= Number(rule.value);
    case 'lessThan':
      return Number(actual) < Number(rule.value);
    case 'lessThanOrEqual':
      return Number(actual) <= Number(rule.value);
    default:
      throw new Error(`Unsupported rule operator: ${rule.operator}`);
  }
}

export const generatedRuleHelperCode = `const getAuthoringPathValue = (data, path) =>
  String(path)
    .split('.')
    .reduce((current, segment) => {
      if (current === null || current === undefined) return undefined;
      return current[segment];
    }, data);

const evaluateAuthoringRule = (rule, formData = {}) => {
  if (rule.all) return rule.all.every(child => evaluateAuthoringRule(child, formData));
  if (rule.any) return rule.any.some(child => evaluateAuthoringRule(child, formData));
  if (rule.not) return !evaluateAuthoringRule(rule.not, formData);

  const actual = getAuthoringPathValue(formData, rule.field);

  switch (rule.operator) {
    case 'equals':
      return actual === rule.value;
    case 'notEquals':
      return actual !== rule.value;
    case 'in':
      return rule.value.includes(actual);
    case 'notIn':
      return !rule.value.includes(actual);
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'notExists':
      return actual === undefined || actual === null || actual === '';
    case 'greaterThan':
      return Number(actual) > Number(rule.value);
    case 'greaterThanOrEqual':
      return Number(actual) >= Number(rule.value);
    case 'lessThan':
      return Number(actual) < Number(rule.value);
    case 'lessThanOrEqual':
      return Number(actual) <= Number(rule.value);
    default:
      return false;
  }
};`;
