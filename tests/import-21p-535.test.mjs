import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21P_535_FIXTURE = new URL('../../form-samples/VBA-21P-535-ARE.pdf', import.meta.url);

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

test('VBA 21P-535 imports as a curated parent DIC workflow', async t => {
  if (!(await fixtureAvailable(FORM_21P_535_FIXTURE))) {
    t.skip('VBA 21P-535 sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21P_535_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21P-535-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 222);
  assert.equal(importReport.componentCount, 204);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21p-535-parent-dic-2024-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 204);
  assert.equal(importReport.curation.curatedFieldCount, 204);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran identity',
      'Claimant information',
      'Veteran active duty service',
      'D.I.C. claim information',
      'Parent information',
      'Parent marital history',
      'Nursing home care and aid attendance',
      'Parent income information',
      'Medical, last illness, and burial expenses',
      'Direct deposit information',
      'Certification and signature',
      'Remarks',
      'SSA-24 survivors benefits application',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSsn')?.type, 'maskedInput');
  assert.equal(byId('veteranDateOfDeath')?.type, 'date');
  assert.equal(byId('claimantEmail')?.type, 'email');
  assert.equal(byId('claimantTelephone')?.type, 'phone');
  assert.equal(byId('claimingDicPactActReevaluation')?.type, 'yesNo');
  assert.equal(byId('parent1Address')?.type, 'address');
  assert.equal(byId('parent1Email')?.type, 'email');
  assert.equal(byId('parentMaritalStatus')?.type, 'radioButton');
  assert.equal(byId('needsRegularAssistance')?.type, 'yesNo');
  assert.equal(byId('parentMonthlySocialSecurity')?.type, 'textInput');
  assert.equal(byId('expense8Purpose')?.type, 'textInput');
  assert.equal(byId('accountType')?.type, 'radioButton');
  assert.equal(byId('parent1SignatureDate')?.type, 'date');
  assert.equal(byId('remarks')?.type, 'textArea');
  assert.equal(byId('ssaVeteranWorkedInRailroadIndustry')?.type, 'yesNo');
  assert.equal(byId('ssaApplicantMailingAddress')?.type, 'address');
  assert.equal(byId('ssaProofsRequested')?.type, 'radioButton');
  assert.equal(byId('ssaTransmittalDate')?.type, 'date');

  assert.deepEqual(
    byId('parentMaritalStatus')?.responseOptions?.map(option => option.label),
    [
      'Married and live with other parent of Veteran',
      'Married and live with spouse who is not the other parent of Veteran',
      'Separated',
      'Divorced',
      'Widowed',
      'Never married',
    ],
  );
  assert.deepEqual(
    byId('accountType')?.responseOptions?.map(option => option.label),
    [
      'Checking',
      'Savings',
      'I certify that I do not have an account with a financial institution or certified payment agent',
    ],
  );
  assert.deepEqual(
    byId('ssaApplicantRelationship')?.responseOptions?.map(option => option.label),
    ['Surviving spouse or surviving divorced spouse', 'Child', 'Parent'],
  );

  assert.ok(labels.includes('Parent monthly Social Security income'));
  assert.ok(labels.includes('Spouse annual total dividends and interest'));
  assert.ok(labels.includes('Expense 10 Relationship of person for whom expenses were paid'));
  assert.ok(labels.includes('SSA-24 service 3 date separated from active service'));
  assert.ok(labels.includes('SSA-24 transmitting VA office name and address'));

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(
    labels.some(label =>
      /\b(?:Text Field|Vafile|VBA21535|expenses, etc\.|\(page|DO NOT$)\b/i.test(label),
    ),
    false,
  );
  assert.equal(labels.some(label => label.length > 95), false);
});
