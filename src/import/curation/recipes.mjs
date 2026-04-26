import seedCatalog from './catalog.json' with { type: 'json' };

const PATTERN_FIELDS = ['allText', 'anyText', 'fieldNamePatterns'];
const SELECTOR_PATTERN_FIELDS = ['namePattern', 'labelPattern', 'textPattern'];
const SELECTOR_REQUIRED_FIELDS = [...SELECTOR_PATTERN_FIELDS, 'componentPatternRole'];
const RESERVED_COMPONENT_KEYS = ['id', 'provenance'];

let runtimeRecipes = [];

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validatePattern(value, path, errors) {
  if (!hasText(value)) {
    errors.push(`${path} must be a non-empty string`);
    return;
  }
  try {
    new RegExp(value);
  } catch (error) {
    errors.push(`${path} must be a valid regular expression: ${error.message}`);
  }
}

function validatePatternArray(value, path, errors) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  value.forEach((pattern, index) => validatePattern(pattern, `${path}[${index}]`, errors));
}

function validateMatch(match, path, errors) {
  if (!isObject(match)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of PATTERN_FIELDS) {
    validatePatternArray(match[key], `${path}.${key}`, errors);
  }
  if (match.minFieldMatches !== undefined) {
    if (typeof match.minFieldMatches !== 'number' || match.minFieldMatches < 0) {
      errors.push(`${path}.minFieldMatches must be a number greater than or equal to 0`);
    }
  }
}

function validateSelector(selector, path, errors) {
  if (!isObject(selector)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const present = SELECTOR_REQUIRED_FIELDS.filter(key => selector[key] !== undefined);
  if (present.length === 0) {
    errors.push(`${path} must include at least one of ${SELECTOR_REQUIRED_FIELDS.join(', ')}`);
  }
  for (const key of SELECTOR_PATTERN_FIELDS.filter(key => selector[key] !== undefined)) {
    validatePattern(selector[key], `${path}.${key}`, errors);
  }
  if (selector.componentPatternRole !== undefined && !hasText(selector.componentPatternRole)) {
    errors.push(`${path}.componentPatternRole must be a non-empty string`);
  }
  if (selector.componentPatternMinConfidence !== undefined) {
    const value = selector.componentPatternMinConfidence;
    if (typeof value !== 'number' || value < 0 || value > 1) {
      errors.push(`${path}.componentPatternMinConfidence must be a number between 0 and 1`);
    }
  }
}

function validateComponentOverrides(component, path, errors) {
  if (component === undefined) return;
  if (!isObject(component)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of RESERVED_COMPONENT_KEYS) {
    if (Object.hasOwn(component, key)) {
      errors.push(`${path}.${key} cannot be set by a curation recipe`);
    }
  }
}

function validateChapterMetadata(mapping, path, errors) {
  if (mapping.chapterType !== undefined && !['standard', 'listLoop'].includes(mapping.chapterType)) {
    errors.push(`${path}.chapterType must be "standard" or "listLoop"`);
  }
  if (mapping.chapterOptions !== undefined && !isObject(mapping.chapterOptions)) {
    errors.push(`${path}.chapterOptions must be an object when provided`);
  }
  if (mapping.itemNameLabel !== undefined && !hasText(mapping.itemNameLabel)) {
    errors.push(`${path}.itemNameLabel must be a non-empty string when provided`);
  }
  if (mapping.sectionIntro !== undefined && !hasText(mapping.sectionIntro)) {
    errors.push(`${path}.sectionIntro must be a non-empty string when provided`);
  }
}

function validateFieldMapping(mapping, path, errors) {
  if (!isObject(mapping)) {
    errors.push(`${path} must be an object`);
    return;
  }
  validateSelector(mapping.selector, `${path}.selector`, errors);
  if (!hasText(mapping.chapterId)) errors.push(`${path}.chapterId must be a non-empty string`);
  if (!hasText(mapping.pageId)) errors.push(`${path}.pageId must be a non-empty string`);
  if (mapping.id !== undefined && !hasText(mapping.id)) {
    errors.push(`${path}.id must be a non-empty string when provided`);
  }
  validateChapterMetadata(mapping, path, errors);
  validateComponentOverrides(mapping.component, `${path}.component`, errors);
}

export function validateRecipe(recipe, options = {}) {
  const path = options.path || 'recipe';
  const errors = [];

  if (!isObject(recipe)) {
    return { valid: false, errors: [`${path} must be an object`] };
  }

  if (!hasText(recipe.id)) errors.push(`${path}.id must be a non-empty string`);
  validateMatch(recipe.match, `${path}.match`, errors);

  if (!Array.isArray(recipe.fields) || recipe.fields.length === 0) {
    errors.push(`${path}.fields must be a non-empty array`);
  } else {
    recipe.fields.forEach((mapping, index) =>
      validateFieldMapping(mapping, `${path}.fields[${index}]`, errors),
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateRecipeCatalog(catalog) {
  const errors = [];

  if (!isObject(catalog)) {
    return { valid: false, errors: ['catalog must be an object'] };
  }
  if (!hasText(catalog.version)) errors.push('catalog.version must be a non-empty string');
  if (!Array.isArray(catalog.recipes)) {
    errors.push('catalog.recipes must be an array');
  } else {
    const ids = new Set();
    catalog.recipes.forEach((recipe, index) => {
      const result = validateRecipe(recipe, { path: `catalog.recipes[${index}]` });
      errors.push(...result.errors);
      if (hasText(recipe?.id)) {
        if (ids.has(recipe.id)) {
          errors.push(`catalog.recipes[${index}].id duplicates "${recipe.id}"`);
        }
        ids.add(recipe.id);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidRecipeCatalog(catalog) {
  const result = validateRecipeCatalog(catalog);
  if (!result.valid) {
    throw new Error(`Invalid curation recipe catalog:\n${result.errors.join('\n')}`);
  }
  return catalog;
}

export function loadRecipeCatalog(options = {}) {
  const includeRuntime = options.includeRuntime !== false;
  const catalog = {
    version: seedCatalog.version || '0.0.0',
    recipes: [
      ...(Array.isArray(seedCatalog.recipes) ? seedCatalog.recipes : []),
      ...(includeRuntime ? runtimeRecipes : []),
    ],
  };
  assertValidRecipeCatalog(catalog);
  return catalog;
}

export function loadRecipeCatalogVersion() {
  return seedCatalog.version || '0.0.0';
}

export function appendRecipe(recipe) {
  const result = validateRecipe(recipe, { path: 'recipe' });
  if (!result.valid) {
    throw new Error(`Invalid curation recipe:\n${result.errors.join('\n')}`);
  }
  const existingIds = new Set(loadRecipeCatalog().recipes.map(existing => existing.id));
  if (existingIds.has(recipe.id)) {
    throw new Error(`Invalid curation recipe:\nrecipe.id duplicates "${recipe.id}"`);
  }
  runtimeRecipes = [...runtimeRecipes, recipe];
}

export function appendRecipes(recipes) {
  if (!Array.isArray(recipes)) {
    throw new Error('appendRecipes requires an array');
  }
  for (const recipe of recipes) appendRecipe(recipe);
}

export function exportRecipeCatalog(options = {}) {
  const includeRuntime = options.includeRuntime !== false;
  const catalog = loadRecipeCatalog({ includeRuntime });
  return {
    version: catalog.version,
    exportedAt: new Date().toISOString(),
    recipes: catalog.recipes,
  };
}

export function clearRuntimeRecipes() {
  runtimeRecipes = [];
}

export function runtimeRecipeCount() {
  return runtimeRecipes.length;
}
