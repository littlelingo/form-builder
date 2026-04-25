export const DEFAULT_PRIORITY_ORDER = ['external', 'uswdsDocs', 'vetsWebsiteScrape', 'builtIn'];

function ruleSourcePriority(source, priorityOrder) {
  const index = priorityOrder.indexOf(source);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function mergeRules(sourceMap, priorityOrder = DEFAULT_PRIORITY_ORDER) {
  const byId = new Map();

  Object.entries(sourceMap).forEach(([sourceName, rules]) => {
    (rules || []).forEach(rawRule => {
      const rule = { ...rawRule, source: sourceName };
      const incomingPriority = ruleSourcePriority(sourceName, priorityOrder);
      const existing = byId.get(rule.id);
      if (!existing) {
        byId.set(rule.id, { rule, priority: incomingPriority });
        return;
      }
      if (incomingPriority < existing.priority) {
        byId.set(rule.id, { rule, priority: incomingPriority });
      }
    });
  });

  return Array.from(byId.values())
    .sort((a, b) => a.rule.id.localeCompare(b.rule.id))
    .map(entry => entry.rule);
}

export function loadStandards(sourceMap, priorityOrder = DEFAULT_PRIORITY_ORDER) {
  return {
    rules: mergeRules(sourceMap, priorityOrder),
    priorityOrder,
    sources: Object.keys(sourceMap),
  };
}
