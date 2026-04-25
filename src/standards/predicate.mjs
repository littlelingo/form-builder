function getPath(form, path) {
  if (path === undefined || path === null || path === '') return form;
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, form);
}

function eachComponentDeep(components = []) {
  const out = [];
  for (const component of components) {
    out.push(component);
    if (Array.isArray(component.children)) {
      out.push(...eachComponentDeep(component.children));
    }
  }
  return out;
}

function allComponentsForChapter(chapter) {
  return (chapter.pages || []).flatMap(page => eachComponentDeep(page.components || []));
}

function compareNumeric(actual, op, expected) {
  switch (op) {
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    case '==':
      return actual === expected;
    case '>':
      return actual > expected;
    case '<':
      return actual < expected;
    case '!=':
      return actual !== expected;
    default:
      return false;
  }
}

export function evaluatePredicate(predicate, scope) {
  if (!predicate || typeof predicate !== 'object') return true;

  switch (predicate.op) {
    case 'and':
      return (predicate.predicates || []).every(p => evaluatePredicate(p, scope));
    case 'or':
      return (predicate.predicates || []).some(p => evaluatePredicate(p, scope));
    case 'not':
      return !evaluatePredicate(predicate.predicate, scope);

    case 'pathExists': {
      const value = getPath(scope, predicate.path);
      return value !== undefined && value !== null && value !== '';
    }
    case 'pathEquals':
      return getPath(scope, predicate.path) === predicate.value;
    case 'pathIn':
      return Array.isArray(predicate.values) && predicate.values.includes(getPath(scope, predicate.path));
    case 'count': {
      const value = getPath(scope, predicate.path);
      const length = Array.isArray(value)
        ? value.length
        : value && typeof value === 'object'
          ? Object.keys(value).length
          : 0;
      return compareNumeric(length, predicate.compare || predicate.op2 || '>=', predicate.value);
    }

    case 'anyChapterHas':
    case 'everyChapterHas': {
      const chapters = scope.chapters || [];
      const test = chapter =>
        evaluatePredicate(predicate.where, chapter);
      return predicate.op === 'anyChapterHas' ? chapters.some(test) : chapters.every(test);
    }

    case 'anyPageHas':
    case 'everyPageHas': {
      const pages = (scope.chapters || []).flatMap(chapter => chapter.pages || []);
      const test = page => evaluatePredicate(predicate.where, page);
      return predicate.op === 'anyPageHas' ? pages.some(test) : pages.every(test);
    }

    case 'anyComponentHas':
    case 'everyComponentHas': {
      const components = (scope.chapters || []).flatMap(allComponentsForChapter);
      const test = component => evaluatePredicate(predicate.where, component);
      return predicate.op === 'anyComponentHas' ? components.some(test) : components.every(test);
    }

    case 'componentTypeIn':
      return Array.isArray(predicate.types) && predicate.types.includes(scope?.type);

    case 'stringLength': {
      const value = getPath(scope, predicate.field);
      const length = typeof value === 'string' ? value.length : 0;
      if (predicate.min !== undefined && length < predicate.min) return false;
      if (predicate.max !== undefined && length > predicate.max) return false;
      return true;
    }
    case 'stringMatches': {
      const value = getPath(scope, predicate.field);
      if (typeof value !== 'string') return false;
      try {
        return new RegExp(predicate.pattern).test(value);
      } catch {
        return false;
      }
    }
    case 'stringNonEmpty': {
      const value = getPath(scope, predicate.field);
      return typeof value === 'string' && value.trim().length > 0;
    }
    case 'numberInRange': {
      const value = getPath(scope, predicate.field);
      if (typeof value !== 'number') return false;
      if (predicate.min !== undefined && value < predicate.min) return false;
      if (predicate.max !== undefined && value > predicate.max) return false;
      return true;
    }
    case 'enumIn': {
      const value = getPath(scope, predicate.field);
      return Array.isArray(predicate.values) && predicate.values.includes(value);
    }
    case 'fieldEquals':
      return getPath(scope, predicate.field) === predicate.value;

    default:
      return false;
  }
}

export function predicateOps() {
  return [
    'and',
    'or',
    'not',
    'pathExists',
    'pathEquals',
    'pathIn',
    'count',
    'anyChapterHas',
    'everyChapterHas',
    'anyPageHas',
    'everyPageHas',
    'anyComponentHas',
    'everyComponentHas',
    'componentTypeIn',
    'stringLength',
    'stringMatches',
    'stringNonEmpty',
    'numberInRange',
    'enumIn',
    'fieldEquals',
  ];
}
