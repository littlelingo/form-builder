import builtInData from './sources/builtIn.json' with { type: 'json' };

import { auditForm } from './audit.mjs';
import { DEFAULT_PRIORITY_ORDER, loadStandards as loadStandardsFromMap, mergeRules } from './priority.mjs';
import { evaluatePredicate, predicateOps } from './predicate.mjs';

export function loadBuiltInRules() {
  return builtInData.rules || [];
}

export function loadDefaultStandards(priorityOrder = DEFAULT_PRIORITY_ORDER) {
  const sourceMap = {
    builtIn: loadBuiltInRules(),
  };
  return loadStandardsFromMap(sourceMap, priorityOrder);
}

export function auditFormAgainstDefaults(form) {
  const standards = loadDefaultStandards();
  return auditForm(form, standards.rules);
}

export {
  auditForm,
  evaluatePredicate,
  loadStandardsFromMap as loadStandards,
  mergeRules,
  predicateOps,
  DEFAULT_PRIORITY_ORDER,
};
