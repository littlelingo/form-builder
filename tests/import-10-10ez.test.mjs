import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_10_10EZ_FIXTURE = new URL('../../form-samples/VA Form 10-10EZ.pdf', import.meta.url);

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

test('VA Form 10-10EZ imports as a curated health benefits workflow', async t => {
  if (!(await fixtureAvailable(FORM_10_10EZ_FIXTURE))) {
    t.skip('VA Form 10-10EZ sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_10_10EZ_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VA Form 10-10EZ.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 122);
  assert.equal(importReport.componentCount, 116);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-10-10ez-health-benefits-2025-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 116);
  assert.equal(importReport.curation.curatedFieldCount, 116);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Benefit selection',
      'Veteran identity',
      'Veteran contact information',
      'Military service information',
      'Insurance information',
      'Dependent information',
      'Employment information',
      'Financial disclosure',
      'Consent and signature',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('enrollmentBenefit')?.type, 'checkbox');
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('mothersMaidenName')?.type, 'textInput');
  assert.equal(byId('veteranSsn')?.type, 'maskedInput');
  assert.equal(byId('dateOfBirth')?.type, 'date');
  assert.equal(byId('placeOfBirth')?.type, 'textInput');
  assert.equal(byId('mailingAddress')?.type, 'address');
  assert.equal(byId('mobilePhone')?.type, 'phone');
  assert.equal(byId('scheduleFirstAppointment')?.type, 'yesNo');
  assert.equal(byId('purpleHeartRecipient')?.type, 'yesNo');
  assert.equal(byId('healthInsuranceInformation')?.type, 'textArea');
  assert.equal(byId('policyNumber')?.type, 'textInput');
  assert.equal(byId('spouseSsn')?.type, 'maskedInput');
  assert.equal(byId('dateChildBecameDependent')?.type, 'date');
  assert.equal(byId('employmentStatus')?.type, 'radioButton');
  assert.equal(byId('provideFinancialInformation')?.type, 'radioButton');
  assert.equal(byId('applicantSignature')?.type, 'textInput');
  assert.equal(byId('dateSigned')?.type, 'date');

  assert.deepEqual(
    byId('currentMaritalStatus')?.responseOptions?.map(option => option.label),
    ['Married', 'Never married', 'Separated', 'Widowed', 'Divorced'],
  );
  assert.deepEqual(
    byId('employmentStatus')?.responseOptions?.map(option => option.label),
    ['Full time', 'Part time', 'Not employed', 'Retired'],
  );
  assert.deepEqual(
    byId('childRelationshipToYou')?.responseOptions?.map(option => option.label),
    ['Son', 'Daughter', 'Stepson', 'Stepdaughter'],
  );

  assert.ok(labels.includes('Apply for VA health care enrollment'));
  assert.ok(labels.includes('Choose not to answer race or ethnicity'));
  assert.ok(labels.includes('Did you serve in Southwest Asia during the Gulf War?'));
  assert.ok(labels.includes('Health insurance company name, address, and telephone number'));
  assert.ok(labels.includes('Dependent child net income from farm, ranch, property, or business'));
  assert.ok(labels.includes('Non-reimbursed medical expenses paid last year'));

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(
    labels.some(label =>
      /\b(?:Section2|Section8|Lastentrydate|Futuredischargedate|Spousessn|Childssn|Dateof|subform|Last First Middle|SOCIAL SECURITY NO\.|\(page)\b/i.test(label),
    ),
    false,
  );
  assert.equal(labels.some(label => label.length > 95), false);
});
