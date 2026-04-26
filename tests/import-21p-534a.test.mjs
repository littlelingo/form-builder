import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21P_534A_FIXTURE = new URL('../../form-samples/VBA-21P-534a-ARE.pdf', import.meta.url);

async function fixtureAvailable(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

function allComponents(form) {
  return form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
}

test('VBA 21P-534a imports as a curated in-service death DIC workflow', async t => {
  if (!(await fixtureAvailable(FORM_21P_534A_FIXTURE))) {
    t.skip('VBA 21P-534a sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21P_534A_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21P-534a-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 64);
  assert.equal(importReport.componentCount, 36);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21p-534a-dic-in-service-death-2025-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 51);
  assert.equal(importReport.curation.curatedFieldCount, 51);
  assert.deepEqual(
    importReport.curation.decisions.map(decision => ({
      type: decision.type,
      chapterId: decision.chapterId,
      arrayPath: decision.arrayPath,
      sourceFieldCount: decision.sourceFieldCount,
      itemFieldCount: decision.itemFieldCount,
      estimatedItemCount: decision.estimatedItemCount,
    })),
    [
      {
        type: 'listLoop',
        chapterId: 'children',
        arrayPath: 'childrenInCustody',
        sourceFieldCount: 20,
        itemFieldCount: 5,
        estimatedItemCount: 4,
      },
    ],
  );
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran identity',
      'Claimant identity',
      'Children in custody',
      'Claimant contact information',
      'Direct deposit',
      'Claimant signature',
      'Casualty Assistance Officer',
    ],
  );

  assert.deepEqual(
    form.chapters.find(chapter => chapter.id === 'claimantContact').pages.map(page => page.title),
    ['Current contact information', 'Change of address'],
  );
  assert.deepEqual(
    form.chapters.find(chapter => chapter.id === 'directDeposit').pages.map(page => page.title),
    ['Direct deposit information', 'Financial institution information'],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSsn')?.type, 'maskedInput');
  assert.equal(byId('claimantFirstName')?.type, 'textInput');
  assert.equal(byId('claimantSsn')?.type, 'maskedInput');
  assert.equal(byId('survivingSpouseDateOfBirth')?.type, 'date');
  assert.equal(byId('childDateOfBirth')?.type, 'date');
  assert.equal(byId('childSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('claimantCurrentMailingAddress')?.type, 'address');
  assert.equal(byId('claimantDaytimePhone')?.type, 'phone');
  assert.equal(byId('accountNumber')?.type, 'textInput');
  assert.equal(byId('routingNumber')?.type, 'textInput');
  assert.equal(byId('dateSigned')?.type, 'date');
  assert.equal(byId('caoPhone')?.type, 'phone');
  assert.equal(byId('caoEmail')?.type, 'email');

  assert.ok(labels.includes('I lived continuously with the Veteran from marriage until the date of death'));
  assert.ok(labels.includes('Child relationship to claimant'));
  assert.ok(labels.includes('Claimant current mailing address'));
  assert.ok(labels.includes('I want VA payment directly deposited to my financial account'));
  assert.ok(labels.includes('Name and rank of Military Casualty Assistance Officer'));

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => /\b(?:subform|NumberAndStreet|SSNChild|PlaceBirth)\b/i.test(label)), false);
  assert.equal(labels.some(label => label.length > 95), false);

  const children = form.chapters.find(chapter => chapter.id === 'children');
  assert.equal(children?.type, 'listLoop');
  assert.deepEqual(children?.options, {
    nounSingular: 'child',
    nounPlural: 'children',
    arrayPath: 'childrenInCustody',
    required: false,
    maxItems: 10,
  });
  assert.equal(children?.itemNameLabel, 'Child full name');
  assert.equal(children?.sectionIntro, 'Add each child in custody listed on the source form.');
  assert.deepEqual(
    children?.pages[0].components.map(component => component.id),
    [
      'childFullName',
      'childDateOfBirth',
      'childSocialSecurityNumber',
      'childPlaceOfBirth',
      'childRelationshipToClaimant',
    ],
  );
  assert.equal(children?.pages[0].components[0].summaryCard, true);
});
