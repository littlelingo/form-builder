import { applyComputedValues, evaluateRule } from '../../../../src/index.mjs';

export function cloneValue(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

export function getPathValue(data, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => {
      if (current === null || current === undefined) return undefined;
      return current[segment];
    }, data);
}

export function setPathValue(data, path, value) {
  const segments = String(path).split('.').filter(Boolean);
  if (!segments.length) return data;

  const next = cloneValue(data || {});
  let current = next;
  segments.slice(0, -1).forEach((segment, index) => {
    const nextSegment = segments[index + 1];
    if (current[segment] === undefined || current[segment] === null) {
      current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    current = current[segment];
  });
  current[segments[segments.length - 1]] = value;
  return next;
}

export function flattenComponents(components = []) {
  return components.flatMap(component => [
    component,
    ...flattenComponents(component.type === 'sectionGroup' ? component.children || [] : []),
  ]);
}

const CONTENT_ONLY_COMPONENT_TYPES = new Set([
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
]);

export function isAnswerComponent(component) {
  return !CONTENT_ONLY_COMPONENT_TYPES.has(component?.type);
}

export function componentMap(form) {
  return new Map(
    (form.chapters || [])
      .flatMap(chapter => chapter.pages || [])
      .flatMap(page => flattenComponents(page.components || []))
      .map(component => [component.id, component]),
  );
}

export function applyRunnerComputedValues(form, data, warnings = []) {
  try {
    return applyComputedValues(form.computedValues || [], data || {});
  } catch (error) {
    warnings.push({
      level: 'warning',
      message: `Computed values failed: ${error.message}`,
    });
    return data || {};
  }
}

export function evaluateRunnerRule(rule, data, warnings = [], label = 'condition') {
  if (!rule) return true;
  try {
    return Boolean(evaluateRule(rule, data || {}));
  } catch (error) {
    warnings.push({
      level: 'warning',
      message: `${label} could not be evaluated: ${error.message}`,
    });
    return true;
  }
}

export function runtimeComponentState(runtimeState, componentId) {
  return runtimeState?.components?.[componentId] || {};
}

export function isComponentVisible(component, data, runtimeState = {}, warnings = []) {
  const runtime = runtimeComponentState(runtimeState, component.id);
  if (typeof runtime.visible === 'boolean') return runtime.visible;
  if (component.showIf) return evaluateRunnerRule(component.showIf, data, warnings, `${component.id}.showIf`);
  if (component.hideIf) return !evaluateRunnerRule(component.hideIf, data, warnings, `${component.id}.hideIf`);
  return true;
}

export function isComponentRequired(component, data, runtimeState = {}, warnings = []) {
  const runtime = runtimeComponentState(runtimeState, component.id);
  if (typeof runtime.required === 'boolean') return runtime.required;
  if (component.requiredIf) {
    return evaluateRunnerRule(component.requiredIf, data, warnings, `${component.id}.requiredIf`);
  }
  return Boolean(component.required);
}

export function visibleComponentsForPage(page, data, runtimeState = {}, warnings = []) {
  return flattenComponents(page?.components || []).filter(component =>
    isComponentVisible(component, data, runtimeState, warnings),
  );
}

function hasDisplayValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.values(value).some(hasDisplayValue);
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function formatReviewValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not provided';
  if (value && typeof value === 'object') {
    const parts = Object.values(value).filter(hasDisplayValue).map(item => String(item));
    return parts.length ? parts.join(', ') : 'Not provided';
  }
  return hasDisplayValue(value) ? String(value) : 'Not provided';
}

function nonEmptyPayloadPaths(value, prefix = '') {
  if (!hasDisplayValue(value)) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => nonEmptyPayloadPaths(item, `${prefix}.${index}`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      nonEmptyPayloadPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return prefix ? [prefix] : [];
}

function authoredAnswerFields(form, computedData = {}) {
  return (form.chapters || []).flatMap(chapter => {
    if (chapter.type === 'listLoop') {
      const arrayPath = listArrayPath(chapter);
      return listItemsForChapter(computedData, chapter).flatMap((item, itemIndex) =>
        (chapter.pages || [])
          .flatMap(page => flattenComponents(page.components || []))
          .filter(isAnswerComponent)
          .map(component => ({
            path: `${arrayPath}.${itemIndex}.${component.id}`,
            label: `${chapter.title}: ${component.label}`,
            value: item?.[component.id],
          }))
          .filter(field => hasDisplayValue(field.value)),
      );
    }

    return (chapter.pages || [])
      .flatMap(page => flattenComponents(page.components || []))
      .filter(isAnswerComponent)
      .map(component => ({
        path: component.id,
        label: component.label,
        value: getPathValue(computedData, component.id),
      }))
      .filter(field => hasDisplayValue(field.value));
  });
}

function computedValuePreview(form, computedData = {}) {
  return (form.computedValues || [])
    .map(definition => ({
      id: definition.id,
      target: definition.target,
      value: getPathValue(computedData, definition.target),
      displayValue: formatReviewValue(getPathValue(computedData, definition.target)),
    }))
    .filter(item => item.value !== undefined);
}

export function listArrayPath(chapter) {
  return chapter.options?.arrayPath || chapter.id;
}

export function listItemsForChapter(data, chapter) {
  const items = getPathValue(data || {}, listArrayPath(chapter));
  return Array.isArray(items) ? items : [];
}

export function listItemContext(data, chapter, itemIndex) {
  const item = listItemsForChapter(data, chapter)[itemIndex] || {};
  return {
    ...(data || {}),
    ...item,
  };
}

function pageVisible(page, data, warnings) {
  return evaluateRunnerRule(page?.condition, data, warnings, `${page?.id || 'page'}.condition`);
}

function chapterVisible(chapter, data, warnings) {
  return evaluateRunnerRule(chapter?.condition, data, warnings, `${chapter?.id || 'chapter'}.condition`);
}

export function buildVisibleSteps(form, data = {}, runtimeState = {}, activeListItem = null) {
  const warnings = [];
  const computedData = applyRunnerComputedValues(form, data, warnings);
  const steps = [];

  (form.chapters || []).forEach(chapter => {
    if (!chapterVisible(chapter, computedData, warnings)) return;

    if (chapter.type === 'listLoop') {
      const arrayPath = listArrayPath(chapter);
      steps.push({
        id: `list:${chapter.id}:review`,
        kind: 'listReview',
        chapterId: chapter.id,
        title: chapter.title,
        bodyText: chapter.sectionIntro,
        chapter,
        arrayPath,
      });

      if (activeListItem?.chapterId === chapter.id && Number.isInteger(activeListItem.itemIndex)) {
        const itemIndex = activeListItem.itemIndex;
        const itemData = listItemContext(computedData, chapter, itemIndex);
        (chapter.pages || []).forEach(page => {
          if (!pageVisible(page, itemData, warnings)) return;
          steps.push({
            id: `list:${chapter.id}:${itemIndex}:${page.id}`,
            kind: 'listItemPage',
            chapterId: chapter.id,
            pageId: page.id,
            itemIndex,
            title: page.title,
            bodyText: page.bodyText,
            chapter,
            page,
            arrayPath,
          });
        });
      }
      return;
    }

    (chapter.pages || []).forEach(page => {
      if (!pageVisible(page, computedData, warnings)) return;
      steps.push({
        id: `page:${chapter.id}:${page.id}`,
        kind: 'page',
        chapterId: chapter.id,
        pageId: page.id,
        title: page.title,
        bodyText: page.bodyText,
        chapter,
        page,
      });
    });
  });

  if (!activeListItem && steps.length > 0) {
    steps.push({
      id: 'review:form',
      kind: 'formReview',
      title: 'Review your information',
      bodyText: 'Review the information in this mock runner before submitting.',
    });
  }

  return { steps, computedData, warnings };
}

export function dataForStep(data, step) {
  if (step?.kind === 'listItemPage') {
    return listItemContext(data, step.chapter, step.itemIndex);
  }
  return data || {};
}

export function fieldValueForStep(data, step, componentId) {
  if (step?.kind === 'listItemPage') {
    return listItemsForChapter(data, step.chapter)[step.itemIndex]?.[componentId];
  }
  return getPathValue(data || {}, componentId);
}

export function setFieldValueForStep(data, step, componentId, value) {
  if (step?.kind === 'listItemPage') {
    const arrayPath = step.arrayPath;
    const items = [...listItemsForChapter(data, step.chapter)];
    items[step.itemIndex] = {
      ...(items[step.itemIndex] || {}),
      [componentId]: value,
    };
    return setPathValue(data || {}, arrayPath, items);
  }
  return setPathValue(data || {}, componentId, value);
}

export function appendListItem(data, chapter) {
  const arrayPath = listArrayPath(chapter);
  const items = listItemsForChapter(data, chapter);
  return {
    data: setPathValue(data || {}, arrayPath, [...items, {}]),
    itemIndex: items.length,
  };
}

export function removeListItem(data, chapter, itemIndex) {
  const arrayPath = listArrayPath(chapter);
  const items = listItemsForChapter(data, chapter).filter((_, index) => index !== itemIndex);
  return setPathValue(data || {}, arrayPath, items);
}

export function itemLabel(chapter, item, index) {
  const labelPath = chapter.itemNameLabel;
  const configured = labelPath ? item?.[labelPath] : undefined;
  const fallbackField = flattenComponents(chapter.pages?.[0]?.components || []).find(component => component.summaryCard);
  const fallback = fallbackField ? item?.[fallbackField.id] : undefined;
  return String(configured || fallback || `${chapter.options?.nounSingular || 'Item'} ${index + 1}`);
}

export function itemSummary(chapter, item) {
  const fields = (chapter.pages || [])
    .flatMap(page => flattenComponents(page.components || []))
    .filter(component => hasDisplayValue(item?.[component.id]))
    .slice(0, 3)
    .map(component => `${component.label}: ${formatReviewValue(item?.[component.id])}`);

  return fields.join(' | ');
}

export function buildReviewSections(form, data = {}, runtimeState = {}) {
  const warnings = [];
  const computedData = applyRunnerComputedValues(form, data, warnings);
  const sections = [];

  (form.chapters || []).forEach(chapter => {
    if (!chapterVisible(chapter, computedData, warnings)) return;

    if (chapter.type === 'listLoop') {
      const items = listItemsForChapter(computedData, chapter).map((item, itemIndex) => ({
        itemIndex,
        label: itemLabel(chapter, item, itemIndex),
        summary: itemSummary(chapter, item),
        pages: (chapter.pages || [])
          .filter(page => pageVisible(page, listItemContext(computedData, chapter, itemIndex), warnings))
          .map(page => {
            const itemData = listItemContext(computedData, chapter, itemIndex);
            return {
              id: page.id,
              title: page.title,
              fields: visibleComponentsForPage(page, itemData, runtimeState, warnings)
                .filter(isAnswerComponent)
                .map(component => ({
                  id: component.id,
                  label: component.label,
                  value: item?.[component.id],
                  displayValue: formatReviewValue(item?.[component.id]),
                })),
            };
          }),
      }));

      sections.push({
        id: chapter.id,
        kind: 'listLoop',
        title: chapter.title,
        chapter,
        arrayPath: listArrayPath(chapter),
        items,
      });
      return;
    }

    const pages = (chapter.pages || [])
      .filter(page => pageVisible(page, computedData, warnings))
      .map(page => ({
        id: page.id,
        title: page.title,
        chapterId: chapter.id,
        fields: visibleComponentsForPage(page, computedData, runtimeState, warnings)
          .filter(isAnswerComponent)
          .map(component => {
            const value = getPathValue(computedData, component.id);
            return {
              id: component.id,
              label: component.label,
              value,
              displayValue: formatReviewValue(value),
            };
          }),
      }));

    if (pages.length) {
      sections.push({
        id: chapter.id,
        kind: 'standard',
        title: chapter.title,
        chapter,
        pages,
      });
    }
  });

  return { sections, computedData, warnings };
}

export function buildSubmitPayload(form, data = {}, runtimeState = {}) {
  const warnings = [];
  const computedData = applyRunnerComputedValues(form, data, warnings);
  const payload = {};

  (form.chapters || []).forEach(chapter => {
    if (!chapterVisible(chapter, computedData, warnings)) return;

    if (chapter.type === 'listLoop') {
      const arrayPath = listArrayPath(chapter);
      const items = listItemsForChapter(computedData, chapter).map((item, itemIndex) => {
        const itemPayload = {};
        const itemData = listItemContext(computedData, chapter, itemIndex);
        (chapter.pages || []).forEach(page => {
          if (!pageVisible(page, itemData, warnings)) return;
          visibleComponentsForPage(page, itemData, runtimeState, warnings)
            .filter(isAnswerComponent)
            .forEach(component => {
              const value = item?.[component.id];
              if (value !== undefined && value !== null && value !== '') itemPayload[component.id] = value;
            });
        });
        return itemPayload;
      });
      if (items.length) payload[arrayPath] = items;
      return;
    }

    (chapter.pages || []).forEach(page => {
      if (!pageVisible(page, computedData, warnings)) return;
      visibleComponentsForPage(page, computedData, runtimeState, warnings)
        .filter(isAnswerComponent)
        .forEach(component => {
          const value = getPathValue(computedData, component.id);
          if (value !== undefined && value !== null && value !== '') payload[component.id] = value;
        });
    });
  });

  const payloadPaths = new Set(nonEmptyPayloadPaths(payload));
  const trimmedFields = authoredAnswerFields(form, computedData)
    .filter(field => !payloadPaths.has(field.path))
    .map(field => ({
      path: field.path,
      label: field.label,
      displayValue: formatReviewValue(field.value),
    }));

  return {
    payload,
    computedData,
    computedValues: computedValuePreview(form, computedData),
    trimmedFields,
    warnings,
  };
}
