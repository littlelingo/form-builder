import { classifyComponent } from './heuristic/classify.mjs';
import { segmentIntoChapters, segmentIntoPages } from './heuristic/segment.mjs';
import {
  band,
  computeAcroformSignal,
  computeConfidence,
  computeLabelDistance,
  computeValidationMatch,
} from './confidence.mjs';
import { findNearestExemplar } from './corpus/lookup.mjs';

function toCamelCase(input) {
  if (!input) return '';
  const cleaned = input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return '';
  const [first, ...rest] = cleaned;
  return (
    first.charAt(0).toLowerCase() +
    first.slice(1) +
    rest.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('')
  );
}

function makeUniqueId(base, taken) {
  let candidate = base || 'field';
  if (!candidate.match(/^[a-z]/)) candidate = `f${candidate}`;
  let suffix = 1;
  let unique = candidate;
  while (taken.has(unique)) {
    suffix += 1;
    unique = `${candidate}${suffix}`;
  }
  taken.add(unique);
  return unique;
}

function titleFromId(id, fallback = 'Imported form') {
  if (!id) return fallback;
  return String(id)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, char => char.toUpperCase()) || fallback;
}

function deriveLabel(field) {
  if (field.closestLabel && field.closestLabel.trim().length > 0) {
    return field.closestLabel.trim();
  }
  if (field.name) {
    return field.name
      .replace(/[._-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return 'Untitled field';
}

function fieldNameStem(pdfFieldName) {
  const raw = String(pdfFieldName || '')
    .split('.')
    .pop()
    ?.replace(/\[\d+\]$/g, '')
    .replace(/^#?subform$/i, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\b[a-z]/g, char => char.toUpperCase())
    .replace(/\bVa\b/g, 'VA')
    .replace(/\bSsn\b/g, 'SSN');
}

function labelKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWeakImportedLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  return (
    !/[a-z0-9]/i.test(normalized) ||
    /^page\s+\d+$/i.test(normalized) ||
    /^\([^)]*\)$/.test(normalized) ||
    /^(city|country|state\/province|zip code\/postal code|month|day|year|yes|no|radio option)$/i.test(normalized)
  );
}

function isUsefulFieldStem(stem) {
  return stem &&
    !/^(field|subform|form|check box|checkbox|radio button list)$/i.test(stem);
}

function cleanImportedLabel(label) {
  const text = String(label || '').replace(/\s+/g, ' ').trim();
  if (/^do not pay me va compensation\b/i.test(text)) {
    return 'Do not pay me VA compensation';
  }
  return text;
}

function importedComponentLabel(component) {
  const label = cleanImportedLabel(component.label);
  const stem = cleanImportedLabel(fieldNameStem(component.provenance?.pdfFieldName));
  if ((label.length > 90 || isWeakImportedLabel(label)) && isUsefulFieldStem(stem)) {
    return stem;
  }
  if (label.length > 90) {
    return `${label.slice(0, 86).trim()}...`;
  }
  return label || stem || 'Imported field';
}

function allComponents(chapters) {
  return chapters.flatMap(chapter =>
    (chapter.pages || []).flatMap(page => page.components || []),
  );
}

export function normalizeImportedLabels(chapters) {
  const components = allComponents(chapters);
  for (const component of components) {
    if (component.provenance?.origin === 'pdf-field') {
      component.label = importedComponentLabel(component);
    }
  }

  const byLabel = new Map();
  for (const component of components) {
    const key = labelKey(component.label);
    if (!key) continue;
    if (!byLabel.has(key)) byLabel.set(key, []);
    byLabel.get(key).push(component);
  }

  for (const group of byLabel.values()) {
    if (group.length < 2) continue;
    group.forEach((component, index) => {
      const page = Number.isInteger(component.provenance?.pdfPage)
        ? component.provenance.pdfPage + 1
        : null;
      const suffix = page ? `page ${page}.${index + 1}` : `field ${index + 1}`;
      const base = component.label.replace(/\s+\((?:page|field)\s+\d+(?:\.\d+)?\)$/i, '');
      const maxBaseLength = Math.max(20, 87 - suffix.length);
      const trimmedBase = base.length > maxBaseLength
        ? `${base.slice(0, maxBaseLength - 3).trim()}...`
        : base;
      component.label = `${trimmedBase} (${suffix})`;
    });
  }

  return chapters;
}

function buildResponseOptions(field) {
  if (!Array.isArray(field.options) || field.options.length === 0) return undefined;
  return field.options.map(opt => ({
    value: toCamelCase(opt) || opt,
    label: opt,
  }));
}

function applyComponentOverrides(component, overrides = {}) {
  if (!overrides || typeof overrides !== 'object') return component;
  const { id, provenance, ...safeOverrides } = overrides;
  return { ...component, ...safeOverrides };
}

function buildComponent(field, takenIds, corpus = []) {
  const heuristic = classifyComponent(field);
  const enriched = field.enriched || null;
  // After-LLM-enrich, we re-pair the field's "closest label" with the cleaned
  // label so corpus lookup uses the cleaned label tokens.
  const fieldForCorpus = enriched
    ? { ...field, closestLabel: enriched.label || field.closestLabel }
    : field;
  const exemplarMatch = findNearestExemplar(fieldForCorpus, corpus);

  let componentType = heuristic.componentType;
  let classificationCertainty = heuristic.heuristicConfidence;
  let exemplarId = null;
  let exemplarLabel = null;
  let corpusSimilarity = 0;

  if (enriched) {
    if (enriched.type) componentType = enriched.type;
    if (typeof enriched.classificationCertainty === 'number') {
      classificationCertainty = Math.max(classificationCertainty, enriched.classificationCertainty);
    }
  }

  if (exemplarMatch) {
    exemplarId = exemplarMatch.exemplar.exemplarId;
    exemplarLabel = exemplarMatch.exemplar.labelAfter || null;
    corpusSimilarity = Number(exemplarMatch.similarity.toFixed(3));
    if (exemplarMatch.exemplar.componentTypeAfter && !enriched) {
      componentType = exemplarMatch.exemplar.componentTypeAfter;
      classificationCertainty = Math.max(classificationCertainty, exemplarMatch.similarity);
    }
  }

  const baseId =
    field.semanticId ||
    toCamelCase(enriched?.label || field.name) ||
    toCamelCase(field.closestLabel) ||
    'field';
  const id = makeUniqueId(baseId, takenIds);
  const label = enriched?.label || exemplarLabel || deriveLabel(field);

  const component = {
    id,
    type: componentType,
    label,
    provenance: {
      origin: field.provenanceOrigin || 'pdf-field',
      pdfFieldName: field.name || null,
      pdfPage: field.bbox?.page ?? null,
      bbox: field.bbox || null,
      confidence: 0,
      reviewed: false,
      lastCorrectedBy: null,
      exemplarId,
    },
  };

  if (field.required) component.required = true;
  if (field.maxLength && componentType !== 'checkbox' && componentType !== 'radioButton') {
    component.maxLength = field.maxLength;
  }
  const responseOptions = buildResponseOptions(field);
  if (responseOptions && (componentType === 'radioButton' || componentType === 'checkbox' || componentType === 'select')) {
    component.responseOptions = responseOptions;
  }
  if (enriched?.hint && !component.hint) {
    component.hint = enriched.hint;
  }
  if (exemplarMatch?.exemplar?.hint && !component.hint) {
    component.hint = exemplarMatch.exemplar.hint;
  }
  if (!component.hint && field.neighborText && field.neighborText.length > 0 && field.neighborText !== label) {
    component.hint = field.neighborText.slice(0, 240);
  }
  if (enriched?.autocomplete && !component.autocomplete) {
    component.autocomplete = enriched.autocomplete;
  }
  if (exemplarMatch?.exemplar?.autocomplete && !component.autocomplete) {
    component.autocomplete = exemplarMatch.exemplar.autocomplete;
  }
  if (Array.isArray(enriched?.validations) && enriched.validations.length > 0) {
    component.validations = enriched.validations;
  }

  const overridden = applyComponentOverrides(component, field.componentOverrides);

  const acroformSignal = computeAcroformSignal(field);
  const labelDistance = computeLabelDistance({ ...field, closestLabel: label });
  const validationMatch = computeValidationMatch(field, overridden.type || componentType);
  const confidence = computeConfidence({
    acroformSignal,
    labelDistance,
    classificationCertainty,
    corpusSimilarity,
    validationMatch,
  });

  overridden.provenance.confidence = Number(confidence.toFixed(3));
  overridden.provenance.confidenceBand = band(confidence);
  overridden.provenance.signals = {
    acroformSignal: Number(acroformSignal.toFixed(3)),
    labelDistance: Number(labelDistance.toFixed(3)),
    classificationCertainty: Number(classificationCertainty.toFixed(3)),
    corpusSimilarity,
    validationMatch: Number(validationMatch.toFixed(3)),
  };
  if (field.curation) {
    overridden.provenance.curation = field.curation;
  }
  if (field.componentPattern) {
    overridden.provenance.componentPattern = field.componentPattern;
  }

  return overridden;
}

function buildPage(pageGroup, takenIds, corpus) {
  return {
    id: pageGroup.id,
    title: pageGroup.title,
    components: pageGroup.fields.map(field => buildComponent(field, takenIds, corpus)),
  };
}

function buildChapter(chapter, takenIds, corpus) {
  return {
    id: chapter.id,
    type: chapter.type || 'standard',
    title: chapter.title,
    ...(chapter.options !== undefined ? { options: chapter.options } : {}),
    ...(chapter.itemNameLabel !== undefined ? { itemNameLabel: chapter.itemNameLabel } : {}),
    ...(chapter.sectionIntro !== undefined ? { sectionIntro: chapter.sectionIntro } : {}),
    pages: chapter.pages.map(page => buildPage(page, takenIds, corpus)),
  };
}

function sortFieldsByPdfPosition(fields) {
  return [...fields].sort((a, b) => {
    const aPage = a.bbox?.page ?? Number.MAX_SAFE_INTEGER;
    const bPage = b.bbox?.page ?? Number.MAX_SAFE_INTEGER;
    if (aPage !== bPage) return aPage - bPage;
    const ay = a.bbox?.y ?? Number.MAX_SAFE_INTEGER;
    const by = b.bbox?.y ?? Number.MAX_SAFE_INTEGER;
    if (ay !== by) return ay - by;
    return (a.bbox?.x ?? 0) - (b.bbox?.x ?? 0);
  });
}

function sortCuratedFields(fields) {
  return [...fields].sort((a, b) => {
    const aOrder = a.curation?.order;
    const bOrder = b.curation?.order;
    if (Number.isInteger(aOrder) && Number.isInteger(bOrder) && aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return sortFieldsByPdfPosition([a, b])[0] === a ? -1 : 1;
  });
}

function segmentCuratedFields(fields) {
  const curatedFields = fields.filter(field => field.curation?.chapterId && field.curation?.pageId);
  if (curatedFields.length === 0) return null;

  const chapters = [];
  const chapterMap = new Map();

  function getChapter(curation) {
    const chapterId = curation.chapterId;
    if (!chapterMap.has(chapterId)) {
      const chapter = {
        id: chapterId,
        title: curation.chapterTitle || titleFromId(chapterId),
        type: curation.chapterType || 'standard',
        ...(curation.chapterOptions !== undefined ? { options: curation.chapterOptions } : {}),
        ...(curation.itemNameLabel !== undefined ? { itemNameLabel: curation.itemNameLabel } : {}),
        ...(curation.sectionIntro !== undefined ? { sectionIntro: curation.sectionIntro } : {}),
        pages: [],
        pageMap: new Map(),
      };
      chapterMap.set(chapterId, chapter);
      chapters.push(chapter);
    }
    return chapterMap.get(chapterId);
  }

  function getPage(chapter, curation) {
    const pageId = curation.pageId;
    if (!chapter.pageMap.has(pageId)) {
      const page = {
        id: pageId,
        title: curation.pageTitle || titleFromId(pageId, 'Page 1'),
        fields: [],
      };
      chapter.pageMap.set(pageId, page);
      chapter.pages.push(page);
    }
    return chapter.pageMap.get(pageId);
  }

  for (const field of sortCuratedFields(curatedFields)) {
    const chapter = getChapter(field.curation);
    const page = getPage(chapter, field.curation);
    if (chapter.type === 'listLoop') {
      const duplicateKey = field.semanticId || field.name || field.closestLabel;
      if (duplicateKey && page.fields.some(existing =>
        (existing.semanticId || existing.name || existing.closestLabel) === duplicateKey
      )) {
        continue;
      }
    }
    page.fields.push(field);
  }

  const uncuratedFields = fields.filter(field => !field.curation?.chapterId || !field.curation?.pageId);
  if (uncuratedFields.length > 0) {
    const fallbackPages = segmentIntoPages(uncuratedFields);
    const fallbackChapter = {
      id: 'needs-review',
      title: 'Needs review',
      pages: fallbackPages,
    };
    chapters.push(fallbackChapter);
  }

  return chapters.map(chapter => {
    const { pageMap, ...cleanChapter } = chapter;
    return cleanChapter;
  });
}

export function buildAuthoringForm({
  formId,
  title,
  pdfHash,
  pdfUri,
  importedBy,
  fields,
  corpus = [],
}) {
  const chapters = segmentCuratedFields(fields) || segmentIntoChapters(segmentIntoPages(fields));

  const takenIds = new Set();
  const builtChapters = chapters.map(chapter => buildChapter(chapter, takenIds, corpus));
  normalizeImportedLabels(builtChapters);

  return {
    schemaVersion: '1.0.0',
    formDefinitionVersion: 1,
    formId: formId || 'imported-form',
    title: title || formId || 'Imported form',
    rootUrl: `/imported/${formId || 'form'}`,
    submitUrl: `/v0/imported/${formId || 'form'}`,
    componentSystems: {
      primary: 'uswds',
      generated: 'vaFormsSystem',
      preview: 'uswds',
      additional: ['shadcn'],
    },
    prefill: { enabled: false, mappings: [] },
    computedValues: [],
    chapters: builtChapters,
    source: {
      kind: 'pdf',
      uri: pdfUri || null,
      hash: pdfHash || null,
      importedAt: new Date().toISOString(),
      importedBy: importedBy || 'importer',
    },
  };
}
