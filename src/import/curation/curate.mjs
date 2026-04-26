import { findNearestExemplar } from '../corpus/lookup.mjs';
import { assertValidRecipeCatalog, loadRecipeCatalog } from './recipes.mjs';

const DEFAULT_CORPUS_THRESHOLD = 0.72;

function compactText(...values) {
  return values
    .flat()
    .filter(Boolean)
    .map(value => String(value))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safePattern(pattern) {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

function matchesPattern(value, pattern) {
  const regex = safePattern(pattern);
  return regex ? regex.test(String(value || '')) : false;
}

function fieldText(field) {
  return compactText(field?.name, field?.closestLabel, field?.neighborText);
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

function scoreRecipe(recipe, fields, metadata) {
  const match = recipe?.match || {};
  const corpus = compactText(
    metadata.formId,
    metadata.title,
    metadata.filename,
    fields.map(fieldText),
  );

  const allText = Array.isArray(match.allText) ? match.allText : [];
  const anyText = Array.isArray(match.anyText) ? match.anyText : [];
  const fieldNamePatterns = Array.isArray(match.fieldNamePatterns)
    ? match.fieldNamePatterns
    : [];

  if (allText.some(pattern => !matchesPattern(corpus, pattern))) return null;
  if (anyText.length > 0 && !anyText.some(pattern => matchesPattern(corpus, pattern))) {
    return null;
  }

  const fieldMatches = fieldNamePatterns.filter(pattern =>
    fields.some(field => matchesPattern(field.name, pattern)),
  ).length;
  const minFieldMatches =
    typeof match.minFieldMatches === 'number' ? match.minFieldMatches : 0;
  if (fieldMatches < minFieldMatches) return null;

  return allText.length + (anyText.length > 0 ? 1 : 0) + fieldMatches;
}

function selectRecipe(fields, recipes, metadata) {
  let selected = null;
  let selectedScore = -1;
  for (const recipe of recipes) {
    const score = scoreRecipe(recipe, fields, metadata);
    if (score !== null && score > selectedScore) {
      selected = recipe;
      selectedScore = score;
    }
  }
  return selected;
}

function selectorMatches(field, selector = {}) {
  if (selector.namePattern && !matchesPattern(field.name, selector.namePattern)) {
    return false;
  }
  if (selector.labelPattern && !matchesPattern(field.closestLabel, selector.labelPattern)) {
    return false;
  }
  if (selector.textPattern && !matchesPattern(fieldText(field), selector.textPattern)) {
    return false;
  }
  if (selector.componentPatternRole) {
    if (field?.componentPattern?.role !== selector.componentPatternRole) {
      return false;
    }
  }
  if (selector.componentPatternMinConfidence !== undefined) {
    const confidence = Number(field?.componentPattern?.confidence ?? NaN);
    if (!Number.isFinite(confidence) || confidence < selector.componentPatternMinConfidence) {
      return false;
    }
  }
  return Boolean(
    selector.namePattern ||
      selector.labelPattern ||
      selector.textPattern ||
      selector.componentPatternRole,
  );
}

function normalizeCuration(curation = {}, source) {
  const chapterId = curation.chapterId || 'imported';
  const pageId = curation.pageId || 'page1';
  return {
    source,
    ...(curation.order !== undefined ? { order: curation.order } : {}),
    chapterId,
    chapterTitle: curation.chapterTitle || titleFromId(chapterId),
    ...(curation.chapterType !== undefined ? { chapterType: curation.chapterType } : {}),
    ...(curation.chapterOptions !== undefined ? { chapterOptions: curation.chapterOptions } : {}),
    ...(curation.itemNameLabel !== undefined ? { itemNameLabel: curation.itemNameLabel } : {}),
    ...(curation.sectionIntro !== undefined ? { sectionIntro: curation.sectionIntro } : {}),
    pageId,
    pageTitle: curation.pageTitle || titleFromId(pageId, 'Page 1'),
  };
}

function applyRecipe(fields, recipe) {
  const mappings = Array.isArray(recipe?.fields) ? recipe.fields : [];
  let matchedFieldCount = 0;

  const curatedFields = fields.map(field => {
    const mappingIndex = mappings.findIndex(candidate => selectorMatches(field, candidate.selector));
    const mapping = mappingIndex >= 0 ? mappings[mappingIndex] : null;
    if (!mapping) return field;
    matchedFieldCount += 1;
    return {
      ...field,
      semanticId: mapping.id || field.semanticId,
      curation: {
        ...normalizeCuration(mapping, 'recipe'),
        order: mappingIndex,
        recipeId: recipe.id || null,
      },
      componentOverrides: {
        ...(field.componentOverrides || {}),
        ...(mapping.component || {}),
      },
    };
  });

  return {
    fields: curatedFields,
    report: {
      status: matchedFieldCount > 0 ? 'recipe-applied' : 'recipe-no-field-matches',
      recipeId: recipe.id || null,
      recipeName: recipe.title || recipe.id || null,
      matchedFieldCount,
    },
  };
}

function applyCorpus(fields, corpus, options = {}) {
  const threshold =
    typeof options.corpusThreshold === 'number'
      ? options.corpusThreshold
      : DEFAULT_CORPUS_THRESHOLD;
  let matchedFieldCount = 0;

  const curatedFields = fields.map(field => {
    if (field.curation) return field;
    const match = findNearestExemplar(field, corpus, { threshold });
    const exemplar = match?.exemplar;
    if (!exemplar?.chapterId || !exemplar?.pageId) return field;

    matchedFieldCount += 1;
    return {
      ...field,
      curation: {
        ...normalizeCuration(
          {
            chapterId: exemplar.chapterId,
            chapterTitle: exemplar.chapterTitle,
            pageId: exemplar.pageId,
            pageTitle: exemplar.pageTitle,
          },
          'corpus',
        ),
        exemplarId: exemplar.exemplarId || null,
        similarity: Number(match.similarity.toFixed(3)),
      },
    };
  });

  return { fields: curatedFields, matchedFieldCount };
}

function summarizeCurationDecisions(fields) {
  const loopGroups = new Map();

  for (const field of fields) {
    const curation = field?.curation;
    if (curation?.chapterType !== 'listLoop') continue;
    const key = `${curation.source || 'curation'}:${curation.chapterId}:${curation.pageId}`;
    if (!loopGroups.has(key)) {
      loopGroups.set(key, {
        type: 'listLoop',
        source: curation.source || 'curation',
        recipeId: curation.recipeId || null,
        chapterId: curation.chapterId,
        chapterTitle: curation.chapterTitle,
        pageId: curation.pageId,
        pageTitle: curation.pageTitle,
        arrayPath: curation.chapterOptions?.arrayPath || null,
        nounSingular: curation.chapterOptions?.nounSingular || null,
        nounPlural: curation.chapterOptions?.nounPlural || null,
        sourceFieldCount: 0,
        _items: new Map(),
      });
    }
    const decision = loopGroups.get(key);
    decision.sourceFieldCount += 1;
    const itemId = field.semanticId || field.componentOverrides?.id || field.name || field.closestLabel;
    if (itemId && !decision._items.has(itemId)) {
      const label = field.componentOverrides?.label || field.closestLabel || itemId;
      decision._items.set(itemId, {
        id: itemId,
        label,
        order: Number.isInteger(curation.order) ? curation.order : Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return [...loopGroups.values()].map(({ _items, ...decision }) => {
    const items = [..._items.values()].sort((a, b) => a.order - b.order);
    const itemFieldIds = items.map(item => item.id);
    const itemFieldLabels = items.map(item => item.label);
    const itemFieldCount = itemFieldIds.length;
    const estimatedItemCount =
      itemFieldCount > 0 && decision.sourceFieldCount % itemFieldCount === 0
        ? decision.sourceFieldCount / itemFieldCount
        : null;
    return {
      ...decision,
      itemFieldIds,
      itemFieldLabels,
      itemFieldCount,
      estimatedItemCount,
    };
  });
}

export function curateFields(fields, options = {}) {
  const sourceFields = Array.isArray(fields) ? fields : [];
  const catalog = Array.isArray(options.recipes)
    ? assertValidRecipeCatalog({
        version: 'runtime',
        recipes: options.recipes,
      })
    : assertValidRecipeCatalog(options.recipeCatalog || loadRecipeCatalog());
  const recipes = catalog.recipes;

  const selectedRecipe = selectRecipe(sourceFields, recipes, options.metadata || {});
  const recipeResult = selectedRecipe
    ? applyRecipe(sourceFields, selectedRecipe)
    : {
        fields: sourceFields,
        report: {
          status: 'no-recipe-match',
          recipeId: null,
          recipeName: null,
          matchedFieldCount: 0,
        },
      };

  const corpusResult = applyCorpus(recipeResult.fields, options.corpus || [], options);
  const curatedFieldCount = corpusResult.fields.filter(field => field.curation).length;

  return {
    fields: corpusResult.fields,
    report: {
      status:
        curatedFieldCount > 0
          ? 'curated'
          : recipeResult.report.status === 'no-recipe-match'
            ? 'generic-fallback'
            : recipeResult.report.status,
      recipe: recipeResult.report,
      corpus: {
        matchedFieldCount: corpusResult.matchedFieldCount,
      },
      decisions: summarizeCurationDecisions(corpusResult.fields),
      curatedFieldCount,
      totalFieldCount: sourceFields.length,
      recipeCatalogVersion: catalog.version || null,
    },
  };
}
