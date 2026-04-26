import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21_0966_FIXTURE = new URL('../../form-samples/VBA-21-0966-ARE.pdf', import.meta.url);

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

test('VBA 21-0966 imports as a curated intent-to-file workflow', async t => {
  if (!(await fixtureAvailable(FORM_21_0966_FIXTURE))) {
    t.skip('VBA 21-0966 sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21_0966_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21-0966-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 61);
  assert.equal(importReport.componentCount, 32);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21-0966-intent-to-file-2023-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 32);
  assert.equal(importReport.curation.curatedFieldCount, 32);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran identity',
      'Veteran contact information',
      'Claimant identity',
      'Claimant contact information',
      'Benefit election',
      'Declaration and signature',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSsn')?.type, 'maskedInput');
  assert.equal(byId('veteranDateOfBirth')?.type, 'date');
  assert.equal(byId('veteranMailingAddress')?.type, 'address');
  assert.equal(byId('veteranTelephoneNumber')?.type, 'phone');
  assert.equal(byId('veteranEmailAddress')?.type, 'email');
  assert.equal(byId('claimantFullName')?.type, 'textInput');
  assert.equal(byId('claimantSsn')?.type, 'maskedInput');
  assert.equal(byId('claimantRelationship')?.type, 'radioButton');
  assert.equal(byId('claimantMailingAddress')?.type, 'address');
  assert.equal(byId('claimantTelephoneNumber')?.type, 'phone');
  assert.equal(byId('intentCompensation')?.type, 'checkbox');
  assert.equal(byId('intentPension')?.type, 'checkbox');
  assert.equal(byId('intentSurvivorsPensionOrDic')?.type, 'checkbox');
  assert.equal(byId('dateSigned')?.type, 'date');

  assert.deepEqual(
    byId('claimantRelationship')?.responseOptions?.map(option => option.label),
    ['Spouse', 'Child', 'Fiduciary', 'Veteran service officer', 'Alternate signer', 'Third-party', 'Other'],
  );
  assert.ok(labels.includes('I intend to file for compensation'));
  assert.ok(labels.includes('I intend to file for pension'));
  assert.ok(labels.includes('Signature of Veteran, claimant, or authorized agent'));

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => /\b(?:subform|NumberAndStreet|LastFourNumbers)\b/i.test(label)), false);
  assert.equal(labels.some(label => label.length > 95), false);
});
