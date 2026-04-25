import { validateRecipe, validateRecipeCatalog } from './recipes.mjs';

const DEFAULT_VERSION = '2026.04';

const COMPONENT_OVERRIDE_KEYS = [
  'type',
  'label',
  'hint',
  'description',
  'required',
  'requiredIf',
  'showIf',
  'hideIf',
  'summaryCard',
  'responseOptions',
  'validations',
  'errorMessages',
  'inputType',
  'autocomplete',
  'multiple',
  'accept',
  'maxFileSize',
  'minFileSize',
  'maxFileCount',
  'fileUploadUrl',
  'endpoint',
  'formNumber',
  'skipUpload',
  'disallowEncryptedPdfs',
  'maxLength',
  'minLength',
  'pattern',
  'minimum',
  'maximum',
  'dateFormat',
  'startLabel',
  'endLabel',
  'startHint',
  'endHint',
  'allowFutureDates',
  'militaryAddress',
  'omit',
  'labels',
  'rows',
  'headerRow',
  'alertType',
];

function slug(value, fallback = 'recipe') {
  const text = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || fallback;
}

function regexEscape(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function compact(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function flattenComponents(components = []) {
  return components.flatMap(component => [
    component,
    ...flattenComponents(component.children || []),
  ]);
}

function pickComponentOverrides(component) {
  const picked = {};
  for (const key of COMPONENT_OVERRIDE_KEYS) {
    if (component[key] !== undefined) {
      picked[key] = component[key];
    }
  }
  return picked;
}

function importedReviewedRows(form, options = {}) {
  const reviewedOnly = options.reviewedOnly !== false;
  const rows = [];

  for (const chapter of form?.chapters || []) {
    for (const page of chapter.pages || []) {
      for (const component of flattenComponents(page.components || [])) {
        const provenance = component.provenance;
        if (!provenance?.pdfFieldName) continue;
        if (provenance.origin !== 'pdf-field' && provenance.origin !== 'pdf-static-region') {
          continue;
        }
        if (reviewedOnly && provenance.reviewed !== true) continue;
        rows.push({ chapter, page, component, provenance });
      }
    }
  }

  return rows;
}

function defaultRecipeId(form, createdAt) {
  const stamp = String(createdAt || new Date().toISOString())
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug(form?.formId || form?.title || 'imported-form')}-${stamp}`;
}

function buildMatch(form, rows) {
  const textMatchers = unique([
    compact(form?.formId),
    compact(form?.title),
    compact(form?.source?.uri),
  ]).map(regexEscape);
  const fieldPatterns = rows.map(row => `^${regexEscape(row.provenance.pdfFieldName)}$`);

  return {
    ...(textMatchers.length > 0 ? { anyText: textMatchers } : {}),
    fieldNamePatterns: fieldPatterns,
    minFieldMatches: Math.min(5, Math.max(1, fieldPatterns.length)),
  };
}

export function createRecipeFromAuthoringForm(form, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const rows = importedReviewedRows(form, options);

  if (rows.length === 0) {
    throw new Error('No reviewed imported components are available to promote.');
  }

  const recipe = {
    id: options.id || defaultRecipeId(form, createdAt),
    title: options.title || `${form.title || form.formId || 'Imported form'} recipe`,
    description:
      options.description ||
      'Generated from reviewed imported builder components.',
    formFingerprint: options.formFingerprint || form.formId || undefined,
    createdAt,
    createdBy: options.createdBy || 'builder-review',
    match: buildMatch(form, rows),
    fields: rows.map(({ chapter, page, component, provenance }) => ({
      id: component.id,
      selector: {
        namePattern: `^${regexEscape(provenance.pdfFieldName)}$`,
      },
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      pageId: page.id,
      pageTitle: page.title,
      component: pickComponentOverrides(component),
    })),
  };

  const result = validateRecipe(recipe);
  if (!result.valid) {
    throw new Error(`Generated curation recipe is invalid:\n${result.errors.join('\n')}`);
  }
  return recipe;
}

export function createRecipeCatalogFromAuthoringForm(form, options = {}) {
  const recipe = createRecipeFromAuthoringForm(form, options);
  const catalog = {
    version: options.version || DEFAULT_VERSION,
    generatedAt: options.generatedAt || recipe.createdAt,
    recipes: [recipe],
  };
  const result = validateRecipeCatalog(catalog);
  if (!result.valid) {
    throw new Error(`Generated curation recipe catalog is invalid:\n${result.errors.join('\n')}`);
  }
  return catalog;
}
