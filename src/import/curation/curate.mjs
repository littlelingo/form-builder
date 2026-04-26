import { findNearestExemplar } from '../corpus/lookup.mjs';
import { assertValidRecipeCatalog, loadRecipeCatalog } from './recipes.mjs';

const DEFAULT_CORPUS_THRESHOLD = 0.72;
const DEFAULT_TAXONOMY_MIN_CONFIDENCE = 0.3;
const DEFAULT_TAXONOMY_MIN_LOOP_GROUP_SIZE = 3;

const TAXONOMY_GROUP_LOOP_CONFIG = {
  providerGroup: {
    chapterId: 'treatmentProviders',
    chapterTitle: 'Treatment providers',
    pageId: 'providerDetails',
    pageTitle: 'Provider details',
    chapterOptions: {
      arrayPath: 'providers',
      nounSingular: 'provider',
      nounPlural: 'providers',
    },
    itemNameLabel: 'Provider name',
  },
  dependentGroup: {
    chapterId: 'dependentEntries',
    chapterTitle: 'Dependent entries',
    pageId: 'dependentDetails',
    pageTitle: 'Dependent details',
    chapterOptions: {
      arrayPath: 'dependents',
      nounSingular: 'dependent',
      nounPlural: 'dependents',
    },
    itemNameLabel: 'Dependent name',
  },
  employmentGroup: {
    chapterId: 'employmentEntries',
    chapterTitle: 'Employment entries',
    pageId: 'employmentDetails',
    pageTitle: 'Employment details',
    chapterOptions: {
      arrayPath: 'employmentEntries',
      nounSingular: 'employment entry',
      nounPlural: 'employment entries',
    },
    itemNameLabel: 'Employer name',
  },
  medicalGroup: {
    chapterId: 'medicalEntries',
    chapterTitle: 'Medical entries',
    pageId: 'medicalDetails',
    pageTitle: 'Medical details',
    chapterOptions: {
      arrayPath: 'medicalEntries',
      nounSingular: 'medical entry',
      nounPlural: 'medical entries',
    },
    itemNameLabel: 'Condition or provider',
  },
  financialGroup: {
    chapterId: 'financialEntries',
    chapterTitle: 'Financial entries',
    pageId: 'financialDetails',
    pageTitle: 'Financial details',
    chapterOptions: {
      arrayPath: 'financialEntries',
      nounSingular: 'financial entry',
      nounPlural: 'financial entries',
    },
    itemNameLabel: 'Description',
  },
  serviceGroup: {
    chapterId: 'serviceEntries',
    chapterTitle: 'Service entries',
    pageId: 'serviceDetails',
    pageTitle: 'Service details',
    chapterOptions: {
      arrayPath: 'serviceEntries',
      nounSingular: 'service entry',
      nounPlural: 'service entries',
    },
    itemNameLabel: 'Service detail',
  },
};

const TAXONOMY_GROUP_CHAPTER_CONFIG = {
  providerGroup: {
    chapterId: 'medicalInformation',
    chapterTitle: 'Medical information',
    pageId: 'providerDetails',
    pageTitle: 'Provider details',
  },
  dependentGroup: {
    chapterId: 'relationshipInformation',
    chapterTitle: 'Relationship information',
    pageId: 'dependentDetails',
    pageTitle: 'Dependent details',
  },
  employmentGroup: {
    chapterId: 'employmentInformation',
    chapterTitle: 'Employment information',
    pageId: 'employmentDetails',
    pageTitle: 'Employment details',
  },
  financialGroup: {
    chapterId: 'financialInformation',
    chapterTitle: 'Financial information',
    pageId: 'financialDetails',
    pageTitle: 'Financial details',
  },
  serviceGroup: {
    chapterId: 'militaryService',
    chapterTitle: 'Military service',
    pageId: 'serviceDetails',
    pageTitle: 'Service details',
  },
  claimGroup: {
    chapterId: 'claimInformation',
    chapterTitle: 'Claim information',
    pageId: 'claimDetails',
    pageTitle: 'Claim details',
  },
  identityGroup: {
    chapterId: 'applicantInformation',
    chapterTitle: 'Applicant information',
    pageId: 'applicantDetails',
    pageTitle: 'Applicant details',
  },
  choiceGroup: {
    chapterId: 'formSelections',
    chapterTitle: 'Form selections',
    pageId: 'selectionDetails',
    pageTitle: 'Selection details',
  },
  relationshipGroup: {
    chapterId: 'relationshipInformation',
    chapterTitle: 'Relationship information',
    pageId: 'relationshipDetails',
    pageTitle: 'Relationship details',
  },
  contactGroup: {
    chapterId: 'contactInformation',
    chapterTitle: 'Contact information',
    pageId: 'contactDetails',
    pageTitle: 'Contact details',
  },
  signatureGroup: {
    chapterId: 'certificationAndSignature',
    chapterTitle: 'Certification and signature',
    pageId: 'signatureDetails',
    pageTitle: 'Signature details',
  },
  medicalGroup: {
    chapterId: 'medicalInformation',
    chapterTitle: 'Medical information',
    pageId: 'medicalDetails',
    pageTitle: 'Medical details',
  },
};

const TAXONOMY_FAMILY_CHAPTER_CONFIG = {
  contact: {
    chapterId: 'contactInformation',
    chapterTitle: 'Contact information',
    pageId: 'contactDetails',
    pageTitle: 'Contact details',
  },
  identity: {
    chapterId: 'applicantInformation',
    chapterTitle: 'Applicant information',
    pageId: 'applicantDetails',
    pageTitle: 'Applicant details',
  },
  financial: {
    chapterId: 'financialInformation',
    chapterTitle: 'Financial information',
    pageId: 'financialDetails',
    pageTitle: 'Financial details',
  },
  service: {
    chapterId: 'militaryService',
    chapterTitle: 'Military service',
    pageId: 'serviceDetails',
    pageTitle: 'Service details',
  },
  employment: {
    chapterId: 'employmentInformation',
    chapterTitle: 'Employment information',
    pageId: 'employmentDetails',
    pageTitle: 'Employment details',
  },
  medical: {
    chapterId: 'medicalInformation',
    chapterTitle: 'Medical information',
    pageId: 'medicalDetails',
    pageTitle: 'Medical details',
  },
  relationship: {
    chapterId: 'relationshipInformation',
    chapterTitle: 'Relationship information',
    pageId: 'relationshipDetails',
    pageTitle: 'Relationship details',
  },
  claim: {
    chapterId: 'claimInformation',
    chapterTitle: 'Claim information',
    pageId: 'claimDetails',
    pageTitle: 'Claim details',
  },
  'meta-controls': {
    chapterId: 'formSelections',
    chapterTitle: 'Form selections',
    pageId: 'selectionDetails',
    pageTitle: 'Selection details',
  },
  signature: {
    chapterId: 'certificationAndSignature',
    chapterTitle: 'Certification and signature',
    pageId: 'signatureDetails',
    pageTitle: 'Signature details',
  },
};

const TAXONOMY_ROLE_CHAPTER_OVERRIDES = {
  signature: {
    chapterId: 'certificationAndSignature',
    chapterTitle: 'Certification and signature',
    pageId: 'signatureDetails',
    pageTitle: 'Signature details',
  },
  dateSigned: {
    chapterId: 'certificationAndSignature',
    chapterTitle: 'Certification and signature',
    pageId: 'signatureDetails',
    pageTitle: 'Signature details',
  },
  bankAccount: {
    chapterId: 'directDeposit',
    chapterTitle: 'Direct deposit',
    pageId: 'bankingDetails',
    pageTitle: 'Banking details',
  },
};

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

function toSemanticId(value, fallback = 'field') {
  const parts = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  const [first, ...rest] = parts;
  const id =
    first.toLowerCase() +
    rest.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
  return id || fallback;
}

function loopSemanticSuffix(field, pattern) {
  const text = fieldText(field).toLowerCase();
  if (pattern.role === 'address') {
    if (/\bstreet\b/.test(text)) return 'street';
    if (/\bcity\b/.test(text)) return 'city';
    if (/\bstate\b/.test(text)) return 'state';
    if (/\bzip\b|\bpostal\b/.test(text)) return 'postalCode';
    if (/\bcountry\b/.test(text)) return 'country';
  }
  if (pattern.role === 'name') {
    if (/\bfirst\b/.test(text)) return 'firstName';
    if (/\blast\b/.test(text)) return 'lastName';
    if (/\bmiddle\b/.test(text)) return 'middleName';
    if (/\bfull\b/.test(text)) return 'fullName';
  }
  if (pattern.role === 'effectiveDate') {
    if (/\bfrom\b/.test(text)) return 'fromDate';
    if (/\bto\b/.test(text)) return 'toDate';
  }
  if (pattern.role === 'serviceDate') {
    if (/\bentry\b/.test(text)) return 'entryDate';
    if (/\bseparation\b|\brelease\b/.test(text)) return 'separationDate';
  }
  if (pattern.role === 'currencyAmount') {
    if (/\bmonthly\b/.test(text)) return 'monthlyAmount';
    if (/\byearly\b|\bannual\b/.test(text)) return 'annualAmount';
  }
  return pattern.role || 'field';
}

function taxonomyLoopMapping(pattern) {
  if (!pattern?.groupRole) return null;
  return TAXONOMY_GROUP_LOOP_CONFIG[pattern.groupRole] || null;
}

function taxonomyStandardMapping(pattern) {
  if (!pattern) return null;
  if (TAXONOMY_ROLE_CHAPTER_OVERRIDES[pattern.role]) {
    return TAXONOMY_ROLE_CHAPTER_OVERRIDES[pattern.role];
  }
  if (pattern.groupRole && TAXONOMY_GROUP_CHAPTER_CONFIG[pattern.groupRole]) {
    return TAXONOMY_GROUP_CHAPTER_CONFIG[pattern.groupRole];
  }
  if (pattern.family && TAXONOMY_FAMILY_CHAPTER_CONFIG[pattern.family]) {
    return TAXONOMY_FAMILY_CHAPTER_CONFIG[pattern.family];
  }
  return null;
}

function curationMappingKey(curation = {}) {
  return [
    curation.chapterId || '',
    curation.pageId || '',
    curation.chapterType || '',
    curation.chapterTitle || '',
    curation.pageTitle || '',
  ].join('|');
}

function registerCurationFallback(bucket, curation) {
  const key = curationMappingKey(curation);
  if (!bucket.has(key)) {
    bucket.set(key, {
      count: 0,
      mapping: {
        chapterId: curation.chapterId,
        chapterTitle: curation.chapterTitle,
        chapterType: curation.chapterType,
        chapterOptions: curation.chapterOptions,
        itemNameLabel: curation.itemNameLabel,
        sectionIntro: curation.sectionIntro,
        pageId: curation.pageId,
        pageTitle: curation.pageTitle,
      },
    });
  }
  bucket.get(key).count += 1;
}

function pickMostFrequentCuration(bucket) {
  if (!bucket || bucket.size === 0) return null;
  let selected = null;
  for (const entry of bucket.values()) {
    if (!selected || entry.count > selected.count) {
      selected = entry;
    }
  }
  return selected?.mapping || null;
}

function applyTaxonomy(fields, options = {}) {
  const minConfidence = Number.isFinite(options.taxonomyMinConfidence)
    ? options.taxonomyMinConfidence
    : DEFAULT_TAXONOMY_MIN_CONFIDENCE;
  const minLoopGroupSize = Number.isFinite(options.taxonomyMinLoopGroupSize)
    ? Math.max(2, Math.floor(options.taxonomyMinLoopGroupSize))
    : DEFAULT_TAXONOMY_MIN_LOOP_GROUP_SIZE;

  const curatedFields = [...fields];
  let matchedFieldCount = 0;
  let loopFieldCount = 0;
  const loopGroups = new Map();

  for (const [index, field] of curatedFields.entries()) {
    if (field?.curation) continue;
    const pattern = field?.componentPattern;
    const confidence = Number(pattern?.confidence ?? 0);
    if (!pattern || !Number.isFinite(confidence) || confidence < minConfidence) continue;
    const loopConfig = taxonomyLoopMapping(pattern);
    if (!loopConfig || !pattern.groupKey) continue;
    const key = `${pattern.groupRole}:${pattern.groupKey}`;
    if (!loopGroups.has(key)) loopGroups.set(key, []);
    loopGroups.get(key).push(index);
  }

  for (const indices of loopGroups.values()) {
    if (indices.length < minLoopGroupSize) continue;
    const firstPattern = curatedFields[indices[0]]?.componentPattern;
    const loopConfig = taxonomyLoopMapping(firstPattern);
    if (!firstPattern || !loopConfig) continue;

    const orderMap = new Map();
    for (const index of indices) {
      const field = curatedFields[index];
      if (field?.curation) continue;
      const fieldPattern = field?.componentPattern || firstPattern;
      const semanticId =
        field.semanticId ||
        toSemanticId(loopSemanticSuffix(field, fieldPattern), fieldPattern.role || 'field');
      if (!orderMap.has(semanticId)) orderMap.set(semanticId, orderMap.size);

      curatedFields[index] = {
        ...field,
        semanticId,
        curation: {
          ...normalizeCuration(
            {
              ...loopConfig,
              chapterType: 'listLoop',
              chapterOptions: {
                ...(loopConfig.chapterOptions || {}),
              },
              order: orderMap.get(semanticId),
            },
            'taxonomy',
          ),
          ...(fieldPattern.groupKey ? { groupKey: fieldPattern.groupKey } : {}),
          ...(fieldPattern.groupRole ? { groupRole: fieldPattern.groupRole } : {}),
        },
      };
      matchedFieldCount += 1;
      loopFieldCount += 1;
    }
  }

  for (const [index, field] of curatedFields.entries()) {
    if (field?.curation) continue;
    const pattern = field?.componentPattern;
    const confidence = Number(pattern?.confidence ?? 0);
    if (!pattern || !Number.isFinite(confidence) || confidence < minConfidence) continue;
    const mapping = taxonomyStandardMapping(pattern);
    if (!mapping) continue;

    curatedFields[index] = {
      ...field,
      curation: {
        ...normalizeCuration(mapping, 'taxonomy'),
        ...(pattern.groupKey ? { groupKey: pattern.groupKey } : {}),
        ...(pattern.groupRole ? { groupRole: pattern.groupRole } : {}),
      },
    };
    matchedFieldCount += 1;
  }

  // Attach any remaining unmatched fields to the most common chapter/page mapping
  // on the same PDF page when available, then fall back to the global most-common
  // non-loop mapping. This avoids tiny "Needs review" leftovers for otherwise
  // structured forms without introducing form-specific branches.
  const pageFallbacks = new Map();
  const globalFallbacks = new Map();
  for (const field of curatedFields) {
    const curation = field?.curation;
    if (!curation || curation.chapterType === 'listLoop') continue;
    registerCurationFallback(globalFallbacks, curation);
    if (Number.isInteger(field?.bbox?.page)) {
      const page = field.bbox.page;
      if (!pageFallbacks.has(page)) pageFallbacks.set(page, new Map());
      registerCurationFallback(pageFallbacks.get(page), curation);
    }
  }
  const globalFallback = pickMostFrequentCuration(globalFallbacks);
  for (const [index, field] of curatedFields.entries()) {
    if (field?.curation) continue;
    const pageFallback = Number.isInteger(field?.bbox?.page)
      ? pickMostFrequentCuration(pageFallbacks.get(field.bbox.page))
      : null;
    const mapping = pageFallback || globalFallback;
    if (!mapping?.chapterId || !mapping?.pageId) continue;
    const pattern = field?.componentPattern;
    curatedFields[index] = {
      ...field,
      curation: {
        ...normalizeCuration(mapping, 'taxonomy'),
        ...(pattern?.groupKey ? { groupKey: pattern.groupKey } : {}),
        ...(pattern?.groupRole ? { groupRole: pattern.groupRole } : {}),
      },
    };
    matchedFieldCount += 1;
  }

  return {
    fields: curatedFields,
    matchedFieldCount,
    loopFieldCount,
    minConfidence,
    minLoopGroupSize,
  };
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

function normalizeListLoopOptions(chapterOptions = {}) {
  const options = chapterOptions && typeof chapterOptions === 'object' ? chapterOptions : {};
  const nounSingular = options.nounSingular || 'item';
  const nounPlural = options.nounPlural || (nounSingular === 'item' ? 'items' : `${nounSingular}s`);
  return {
    nounSingular,
    nounPlural,
    required: options.required ?? false,
    ...options,
  };
}

function normalizeCuration(curation = {}, source) {
  const chapterId = curation.chapterId || 'imported';
  const pageId = curation.pageId || 'page1';
  const chapterType = curation.chapterType;
  const chapterOptions = chapterType === 'listLoop'
    ? normalizeListLoopOptions(curation.chapterOptions)
    : curation.chapterOptions;
  return {
    source,
    ...(curation.order !== undefined ? { order: curation.order } : {}),
    chapterId,
    chapterTitle: curation.chapterTitle || titleFromId(chapterId),
    ...(chapterType !== undefined ? { chapterType } : {}),
    ...(chapterOptions !== undefined ? { chapterOptions } : {}),
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
  const taxonomyResult = applyTaxonomy(corpusResult.fields, options);
  const curatedFieldCount = taxonomyResult.fields.filter(field => field.curation).length;
  const hasRecipeMatches = (recipeResult.report.matchedFieldCount || 0) > 0;
  const hasCorpusMatches = (corpusResult.matchedFieldCount || 0) > 0;
  const hasTaxonomyMatches = (taxonomyResult.matchedFieldCount || 0) > 0;

  return {
    fields: taxonomyResult.fields,
    report: {
      status: hasRecipeMatches || hasCorpusMatches
        ? 'curated'
        : hasTaxonomyMatches
          ? 'taxonomy-curated'
          : recipeResult.report.status === 'no-recipe-match'
            ? 'generic-fallback'
            : recipeResult.report.status,
      recipe: recipeResult.report,
      corpus: {
        matchedFieldCount: corpusResult.matchedFieldCount,
      },
      taxonomy: {
        matchedFieldCount: taxonomyResult.matchedFieldCount,
        loopFieldCount: taxonomyResult.loopFieldCount,
        minConfidence: taxonomyResult.minConfidence,
        minLoopGroupSize: taxonomyResult.minLoopGroupSize,
      },
      decisions: summarizeCurationDecisions(taxonomyResult.fields),
      curatedFieldCount,
      totalFieldCount: sourceFields.length,
      recipeCatalogVersion: catalog.version || null,
    },
  };
}
