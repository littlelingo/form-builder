function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function countTemplateFields(components = []) {
  return components.reduce(
    (count, component) =>
      count + (component.type === 'sectionGroup' ? 0 : 1) + countTemplateFields(component.children || []),
    0,
  );
}

function savedTemplateFieldCount(template) {
  if (typeof template.fieldCount === 'number' && Number.isFinite(template.fieldCount)) {
    return Math.max(0, Math.floor(template.fieldCount));
  }
  if (template.kind === 'screen') return countTemplateFields(template.page?.components || []);
  if (template.kind === 'section') return countTemplateFields(template.component?.children || []);
  return 0;
}

function normalizeCustomTemplate(value) {
  if (!value || typeof value !== 'object') return null;
  const template = value;
  if (
    typeof template.id !== 'string' ||
    typeof template.label !== 'string' ||
    (template.kind !== 'screen' && template.kind !== 'section')
  ) {
    return null;
  }

  if (template.kind === 'screen') {
    if (
      !template.page ||
      typeof template.page.id !== 'string' ||
      typeof template.page.title !== 'string' ||
      !Array.isArray(template.page.components)
    ) {
      return null;
    }
  }

  if (template.kind === 'section') {
    if (
      !template.component ||
      typeof template.component.id !== 'string' ||
      typeof template.component.type !== 'string' ||
      typeof template.component.label !== 'string'
    ) {
      return null;
    }
  }

  return {
    id: template.id,
    kind: template.kind,
    label: template.label,
    description: typeof template.description === 'string' ? template.description : undefined,
    createdAt: typeof template.createdAt === 'string' ? template.createdAt : new Date().toISOString(),
    importedAt: typeof template.importedAt === 'string' ? template.importedAt : undefined,
    fieldCount: savedTemplateFieldCount(template),
    ...(template.kind === 'screen' ? { page: cloneJson(template.page) } : {}),
    ...(template.kind === 'section' ? { component: cloneJson(template.component) } : {}),
  };
}

export function normalizeCustomTemplates(value) {
  return Array.isArray(value)
    ? value
        .map(normalizeCustomTemplate)
        .filter(Boolean)
    : [];
}

function uniqueImportedTemplateLabel(label, usedLabels) {
  const baseLabel = label.trim() || 'Imported template';
  const labelKey = baseLabel.toLowerCase();
  if (!usedLabels.has(labelKey)) {
    usedLabels.add(labelKey);
    return baseLabel;
  }

  let index = 1;
  let nextLabel = `${baseLabel} (imported)`;
  while (usedLabels.has(nextLabel.toLowerCase())) {
    index += 1;
    nextLabel = `${baseLabel} (imported ${index})`;
  }
  usedLabels.add(nextLabel.toLowerCase());
  return nextLabel;
}

export function resolveSavedTemplateImport(
  currentTemplates,
  incomingTemplates,
  {
    conflictStrategy = 'rename',
    idPrefix = `custom-imported-${Date.now()}`,
    importedAt = new Date().toISOString(),
    maxTemplates = 25,
  } = {},
) {
  const normalizedTemplates = normalizeCustomTemplates(incomingTemplates);
  const existingLabelKeys = new Set(currentTemplates.map(template => template.label.toLowerCase()));
  const replacementKeys = new Set();
  const usedLabels = new Set(existingLabelKeys);
  let skippedCount = 0;
  let replacedCount = 0;

  const importCandidates = normalizedTemplates.flatMap((template, index) => {
    const baseLabel = template.label.trim() || 'Imported template';
    const labelKey = baseLabel.toLowerCase();
    const conflictsWithExisting = existingLabelKeys.has(labelKey);

    if (conflictsWithExisting && conflictStrategy === 'skip') {
      skippedCount += 1;
      return [];
    }

    if (conflictsWithExisting && conflictStrategy === 'replace' && !replacementKeys.has(labelKey)) {
      replacementKeys.add(labelKey);
      usedLabels.delete(labelKey);
      replacedCount += 1;
    }

    const label = uniqueImportedTemplateLabel(baseLabel, usedLabels);
    return [{
      ...template,
      id: `${idPrefix}-${index}`,
      label,
      createdAt: template.createdAt || new Date().toISOString(),
      importedAt,
      wasRenamed: label !== template.label,
    }];
  });

  const importedTemplates = importCandidates.slice(0, maxTemplates);
  const retainedTemplates = currentTemplates.filter(
    template => !replacementKeys.has(template.label.toLowerCase()),
  );
  const templates = importedTemplates
    .map(({ wasRenamed, ...template }) => template)
    .concat(retainedTemplates)
    .slice(0, maxTemplates);

  return {
    templates,
    result: {
      importedCount: importedTemplates.length,
      renamedCount: importedTemplates.filter(template => template.wasRenamed).length,
      replacedCount,
      skippedCount,
    },
  };
}
