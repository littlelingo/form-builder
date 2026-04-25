import { evaluateRule, getPathValue, validateRule } from './rules.mjs';

const COMPUTED_OPERATIONS = new Set([
  'literal',
  'concat',
  'sum',
  'subtract',
  'multiply',
  'divide',
  'coalesce',
  'mapValue',
  'booleanAny',
  'booleanAll',
]);

const hasValue = value => value !== undefined && value !== null && value !== '';

function readSources(definition, formData) {
  return (definition.sources || []).map(source => getPathValue(formData, source));
}

export function setPathValue(data, path, value) {
  const segments = String(path).split('.').filter(Boolean);
  if (!segments.length) return data;

  let current = data;
  segments.slice(0, -1).forEach(segment => {
    if (!current[segment] || typeof current[segment] !== 'object') {
      current[segment] = {};
    }
    current = current[segment];
  });
  current[segments[segments.length - 1]] = value;

  return data;
}

export function validateComputedValue(definition, path = 'computedValue') {
  const errors = [];

  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return [`${path} must be an object`];
  }

  ['id', 'target', 'operation'].forEach(property => {
    if (!definition[property]) errors.push(`${path}.${property} is required`);
  });

  if (definition.operation && !COMPUTED_OPERATIONS.has(definition.operation)) {
    errors.push(`${path}.operation "${definition.operation}" is not supported`);
  }

  if (definition.condition) {
    errors.push(...validateRule(definition.condition, `${path}.condition`));
  }

  if (
    ['concat', 'sum', 'subtract', 'multiply', 'divide', 'coalesce', 'booleanAny', 'booleanAll'].includes(
      definition.operation,
    ) &&
    (!Array.isArray(definition.sources) || definition.sources.length === 0)
  ) {
    errors.push(`${path}.sources must be a non-empty array for ${definition.operation}`);
  }

  if (definition.operation === 'mapValue') {
    if (!Array.isArray(definition.sources) || definition.sources.length !== 1) {
      errors.push(`${path}.sources must contain exactly one source for mapValue`);
    }
    if (!definition.valueMap || typeof definition.valueMap !== 'object') {
      errors.push(`${path}.valueMap is required for mapValue`);
    }
  }

  return errors;
}

export function evaluateComputedValue(definition, formData = {}) {
  const errors = validateComputedValue(definition);
  if (errors.length) throw new Error(errors.join('; '));

  if (definition.condition) {
    if (!evaluateRule(definition.condition, formData)) return undefined;
  }

  const values = readSources(definition, formData);

  switch (definition.operation) {
    case 'literal':
      return definition.value;
    case 'concat':
      return values.filter(hasValue).join(definition.separator ?? ' ');
    case 'sum':
      return values.reduce((total, value) => total + Number(value || 0), 0);
    case 'subtract':
      return values.slice(1).reduce((total, value) => total - Number(value || 0), Number(values[0] || 0));
    case 'multiply':
      return values.reduce((total, value) => total * Number(value || 0), 1);
    case 'divide':
      return values.slice(1).reduce((total, value) => total / Number(value || 1), Number(values[0] || 0));
    case 'coalesce':
      return values.find(hasValue);
    case 'mapValue':
      return definition.valueMap?.[values[0]] ?? definition.defaultValue;
    case 'booleanAny':
      return values.some(Boolean);
    case 'booleanAll':
      return values.every(Boolean);
    default:
      throw new Error(`Unsupported computed value operation: ${definition.operation}`);
  }
}

export function applyComputedValues(computedValues = [], formData = {}) {
  const nextData = structuredClone(formData);

  computedValues.forEach(definition => {
    const value = evaluateComputedValue(definition, nextData);
    if (value !== undefined) setPathValue(nextData, definition.target, value);
  });

  return nextData;
}

export const generatedComputedHelperCode = `const setAuthoringPathValue = (data, path, value) => {
  const segments = String(path).split('.').filter(Boolean);
  let current = data;
  segments.slice(0, -1).forEach(segment => {
    if (!current[segment] || typeof current[segment] !== 'object') {
      current[segment] = {};
    }
    current = current[segment];
  });
  current[segments[segments.length - 1]] = value;
  return data;
};

const hasAuthoringComputedValue = value => value !== undefined && value !== null && value !== '';

const evaluateAuthoringComputedValue = (definition, formData = {}) => {
  if (definition.condition && !evaluateAuthoringRule(definition.condition, formData)) return undefined;
  const values = (definition.sources || []).map(source => getAuthoringPathValue(formData, source));

  switch (definition.operation) {
    case 'literal':
      return definition.value;
    case 'concat':
      return values.filter(hasAuthoringComputedValue).join(definition.separator ?? ' ');
    case 'sum':
      return values.reduce((total, value) => total + Number(value || 0), 0);
    case 'subtract':
      return values.slice(1).reduce((total, value) => total - Number(value || 0), Number(values[0] || 0));
    case 'multiply':
      return values.reduce((total, value) => total * Number(value || 0), 1);
    case 'divide':
      return values.slice(1).reduce((total, value) => total / Number(value || 1), Number(values[0] || 0));
    case 'coalesce':
      return values.find(hasAuthoringComputedValue);
    case 'mapValue':
      return definition.valueMap?.[values[0]] ?? definition.defaultValue;
    case 'booleanAny':
      return values.some(Boolean);
    case 'booleanAll':
      return values.every(Boolean);
    default:
      return undefined;
  }
};

const applyAuthoringComputedValues = (computedValues = [], formData = {}) => {
  const nextData = JSON.parse(JSON.stringify(formData || {}));
  computedValues.forEach(definition => {
    const value = evaluateAuthoringComputedValue(definition, nextData);
    if (value !== undefined) setAuthoringPathValue(nextData, definition.target, value);
  });
  return nextData;
};`;
