import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_28_1900_FIXTURE = new URL('../../form-samples/VBA-28-1900-ARE.pdf', import.meta.url);

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

test('VBA 28-1900 imports as a curated Veteran Readiness and Employment workflow', async t => {
  if (!(await fixtureAvailable(FORM_28_1900_FIXTURE))) {
    t.skip('VBA 28-1900 sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_28_1900_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-28-1900-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 41);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-28-1900-vre-2024-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 16);
  assert.equal(importReport.curation.curatedFieldCount, 16);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Claimant identity',
      'Contact information',
      'Change of address',
      'Education',
      'Certification and signature',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('applicantFullName')?.type, 'textInput');
  assert.equal(byId('socialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('dateOfBirth')?.type, 'date');
  assert.equal(byId('currentMailingAddress')?.type, 'address');
  assert.equal(byId('mainTelephoneNumber')?.type, 'phone');
  assert.equal(byId('cellPhoneNumber')?.type, 'phone');
  assert.equal(byId('emailAddress')?.type, 'email');
  assert.equal(byId('newMailingAddress')?.type, 'address');
  assert.equal(byId('dateSigned')?.type, 'date');

  assert.ok(labels.includes('Claimant full name'));
  assert.ok(labels.includes('Current mailing address'));
  assert.ok(labels.includes('Electronic correspondence agreement'));
  assert.ok(labels.includes('Number of years of education'));
  assert.ok(labels.includes('Claimant signature'));

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => /\b(?:subform|SignatureField|NumberAndStreet|LastFourNumbers)\b/i.test(label)), false);
  assert.equal(labels.some(label => label.length > 95), false);
});
