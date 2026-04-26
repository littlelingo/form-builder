import assert from 'node:assert/strict';
import { test } from 'node:test';

import { curateFields } from '../src/import/curation/curate.mjs';
import {
  createRecipeCatalogFromAuthoringForm,
  createRecipeFromAuthoringForm,
} from '../src/import/curation/fromAuthoring.mjs';
import {
  appendRecipe,
  appendRecipes,
  clearRuntimeRecipes,
  exportRecipeCatalog,
  loadRecipeCatalog,
  loadRecipeCatalogVersion,
  runtimeRecipeCount,
  validateRecipe,
  validateRecipeCatalog,
} from '../src/import/curation/recipes.mjs';

function validRecipe(overrides = {}) {
  return {
    id: 'test-contact',
    title: 'Test contact recipe',
    match: {
      anyText: ['synthetic'],
      fieldNamePatterns: ['VeteranEmail'],
      minFieldMatches: 1,
    },
    fields: [
      {
        selector: { namePattern: '^VeteranEmail$' },
        chapterId: 'contactInformation',
        chapterTitle: 'Contact information',
        pageId: 'contactDetails',
        pageTitle: 'Contact details',
        component: {
          hint: 'Use an email address where VA can contact you.',
        },
      },
    ],
    ...overrides,
  };
}

const reviewedImportForm = {
  schemaVersion: '1.1.0',
  formId: 'reviewed-form',
  title: 'Reviewed form',
  source: {
    kind: 'pdf',
    uri: 'tests/fixtures/pilot/reviewed.pdf',
  },
  chapters: [
    {
      id: 'contactInformation',
      title: 'Contact information',
      pages: [
        {
          id: 'contactDetails',
          title: 'Contact details',
          components: [
            {
              id: 'emailAddress',
              type: 'email',
              label: 'Email address',
              hint: 'Use an email address where VA can contact you.',
              showIf: {
                field: 'wantsEmail',
                operator: 'equals',
                value: true,
              },
              provenance: {
                origin: 'pdf-field',
                pdfFieldName: 'VeteranEmail',
                confidence: 0.8,
                reviewed: true,
              },
            },
            {
              id: 'unreviewedPhone',
              type: 'phone',
              label: 'Phone number',
              provenance: {
                origin: 'pdf-field',
                pdfFieldName: 'VeteranPhone',
                confidence: 0.5,
                reviewed: false,
              },
            },
            {
              id: 'handAuthored',
              type: 'textInput',
              label: 'Hand-authored field',
              provenance: {
                origin: 'hand-authored',
                confidence: 1,
                reviewed: true,
              },
            },
          ],
        },
      ],
    },
  ],
};

test('seed recipe catalog loads and validates', () => {
  clearRuntimeRecipes();
  const catalog = loadRecipeCatalog();
  assert.equal(loadRecipeCatalogVersion(), '2026.04');
  assert.equal(catalog.version, '2026.04');
  assert.ok(catalog.recipes.length >= 1);
  assert.ok(catalog.recipes.some(recipe => recipe.id === 'va9-appeal-2020-static'));
  assert.equal(validateRecipeCatalog(catalog).valid, true);
});

test('validateRecipe rejects missing selectors and invalid regex patterns', () => {
  const result = validateRecipe(
    validRecipe({
      fields: [
        {
          selector: { namePattern: '[' },
          chapterId: 'contactInformation',
          pageId: 'contactDetails',
        },
        {
          selector: {},
          chapterId: 'contactInformation',
          pageId: 'contactDetails',
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('valid regular expression')));
  assert.ok(result.errors.some(error => error.includes('must include at least one')));
});

test('validateRecipe rejects invalid component-pattern selector metadata', () => {
  const result = validateRecipe(
    validRecipe({
      fields: [
        {
          selector: {
            componentPatternRole: '',
            componentPatternMinConfidence: 1.2,
          },
          chapterId: 'contactInformation',
          pageId: 'contactDetails',
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('componentPatternRole')));
  assert.ok(result.errors.some(error => error.includes('componentPatternMinConfidence')));
});

test('validateRecipe rejects component overrides for reserved identity fields', () => {
  const result = validateRecipe(
    validRecipe({
      fields: [
        {
          selector: { namePattern: '^VeteranEmail$' },
          chapterId: 'contactInformation',
          pageId: 'contactDetails',
          component: {
            id: 'unsafeOverride',
            provenance: {},
          },
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('component.id cannot be set')));
  assert.ok(result.errors.some(error => error.includes('component.provenance cannot be set')));
});

test('runtime recipe appends are visible, exportable, and clearable', () => {
  clearRuntimeRecipes();
  appendRecipe(validRecipe());

  assert.equal(runtimeRecipeCount(), 1);
  assert.equal(loadRecipeCatalog().recipes.filter(recipe => recipe.id === 'test-contact').length, 1);

  const exported = exportRecipeCatalog();
  assert.equal(exported.version, '2026.04');
  assert.match(exported.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(exported.recipes.some(recipe => recipe.id === 'test-contact'));

  clearRuntimeRecipes();
  assert.equal(runtimeRecipeCount(), 0);
  assert.equal(loadRecipeCatalog().recipes.filter(recipe => recipe.id === 'test-contact').length, 0);
});

test('appendRecipes imports many reviewed recipes at once', () => {
  clearRuntimeRecipes();
  appendRecipes([
    validRecipe({ id: 'test-a' }),
    validRecipe({ id: 'test-b' }),
  ]);

  assert.equal(runtimeRecipeCount(), 2);
  clearRuntimeRecipes();
});

test('appendRecipe rejects duplicate recipe ids', () => {
  clearRuntimeRecipes();
  appendRecipe(validRecipe());
  assert.throws(() => appendRecipe(validRecipe()), /duplicates "test-contact"/);
  clearRuntimeRecipes();
});

test('curateFields uses runtime recipe store by default', () => {
  clearRuntimeRecipes();
  appendRecipe(validRecipe());

  const result = curateFields(
    [
      {
        name: 'VeteranEmail',
        closestLabel: 'Email address',
        neighborText: 'synthetic contact details',
      },
      {
        name: 'OtherField',
        closestLabel: 'Other',
      },
    ],
    {
      metadata: {
        filename: 'synthetic.pdf',
      },
    },
  );

  assert.equal(result.report.status, 'curated');
  assert.equal(result.report.recipe.recipeId, 'test-contact');
  assert.equal(result.report.recipe.matchedFieldCount, 1);
  assert.equal(result.fields[0].curation.chapterId, 'contactInformation');
  assert.equal(result.fields[0].componentOverrides.hint, 'Use an email address where VA can contact you.');

  clearRuntimeRecipes();
});

test('curateFields can match fields through component-pattern selectors', () => {
  clearRuntimeRecipes();
  appendRecipe(
    validRecipe({
      id: 'test-pattern-selector',
      match: {
        anyText: ['synthetic'],
        minFieldMatches: 0,
      },
      fields: [
        {
          id: 'emailAddress',
          selector: {
            componentPatternRole: 'email',
            componentPatternMinConfidence: 0.8,
          },
          chapterId: 'contactInformation',
          chapterTitle: 'Contact information',
          pageId: 'contactDetails',
          pageTitle: 'Contact details',
          component: {
            type: 'email',
            label: 'Email address',
          },
        },
      ],
    }),
  );

  const result = curateFields(
    [
      {
        name: 'FieldA',
        closestLabel: 'Reach me at',
        componentPattern: {
          role: 'email',
          confidence: 0.9,
          evidence: ['name:e-mail'],
        },
      },
      {
        name: 'FieldB',
        closestLabel: 'Phone',
      },
    ],
    {
      metadata: { filename: 'synthetic.pdf' },
    },
  );

  assert.equal(result.report.status, 'curated');
  assert.equal(result.report.recipe.recipeId, 'test-pattern-selector');
  assert.equal(result.report.recipe.matchedFieldCount, 1);
  assert.equal(result.fields[0].semanticId, 'emailAddress');
  assert.equal(result.fields[0].curation.chapterId, 'contactInformation');
  assert.equal(result.fields[0].componentOverrides.type, 'email');

  clearRuntimeRecipes();
});

test('curateFields rejects invalid caller-provided recipes before applying them', () => {
  assert.throws(
    () =>
      curateFields([], {
        recipes: [
          validRecipe({
            id: '',
          }),
        ],
      }),
    /Invalid curation recipe catalog/,
  );
});

test('createRecipeFromAuthoringForm promotes reviewed imported components only', () => {
  const recipe = createRecipeFromAuthoringForm(reviewedImportForm, {
    id: 'reviewed-form-recipe',
    createdAt: '2026-04-25T00:00:00.000Z',
  });

  assert.equal(recipe.id, 'reviewed-form-recipe');
  assert.equal(recipe.fields.length, 1);
  assert.deepEqual(recipe.match.fieldNamePatterns, ['^VeteranEmail$']);
  assert.equal(recipe.match.minFieldMatches, 1);

  const [field] = recipe.fields;
  assert.equal(field.id, 'emailAddress');
  assert.deepEqual(field.selector, { namePattern: '^VeteranEmail$' });
  assert.equal(field.chapterId, 'contactInformation');
  assert.equal(field.pageId, 'contactDetails');
  assert.equal(field.component.type, 'email');
  assert.equal(field.component.label, 'Email address');
  assert.equal(field.component.hint, 'Use an email address where VA can contact you.');
  assert.deepEqual(field.component.showIf, {
    field: 'wantsEmail',
    operator: 'equals',
    value: true,
  });
});

test('generated curation recipe can curate matching raw fields', () => {
  const recipe = createRecipeFromAuthoringForm(reviewedImportForm, {
    id: 'reviewed-form-recipe',
    createdAt: '2026-04-25T00:00:00.000Z',
  });
  const result = curateFields(
    [
      {
        name: 'VeteranEmail',
        closestLabel: 'Email',
      },
    ],
    {
      recipes: [recipe],
      metadata: { formId: 'reviewed-form' },
    },
  );

  assert.equal(result.report.status, 'curated');
  assert.equal(result.fields[0].semanticId, 'emailAddress');
  assert.equal(result.fields[0].curation.chapterId, 'contactInformation');
  assert.equal(result.fields[0].componentOverrides.type, 'email');
  assert.equal(result.fields[0].componentOverrides.label, 'Email address');
});

test('createRecipeCatalogFromAuthoringForm returns a validated single-recipe bundle', () => {
  const catalog = createRecipeCatalogFromAuthoringForm(reviewedImportForm, {
    id: 'reviewed-form-recipe',
    createdAt: '2026-04-25T00:00:00.000Z',
    generatedAt: '2026-04-25T00:00:00.000Z',
  });

  assert.equal(validateRecipeCatalog(catalog).valid, true);
  assert.equal(catalog.version, '2026.04');
  assert.equal(catalog.recipes.length, 1);
});

test('createRecipeFromAuthoringForm rejects forms without reviewed imported components', () => {
  assert.throws(
    () =>
      createRecipeFromAuthoringForm({
        ...reviewedImportForm,
        chapters: [
          {
            id: 'c',
            title: 'C',
            pages: [
              {
                id: 'p',
                title: 'P',
                components: [
                  {
                    id: 'unreviewed',
                    type: 'textInput',
                    label: 'Unreviewed',
                    provenance: {
                      origin: 'pdf-field',
                      pdfFieldName: 'Unreviewed',
                      confidence: 0.4,
                      reviewed: false,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    /No reviewed imported components/,
  );
});
