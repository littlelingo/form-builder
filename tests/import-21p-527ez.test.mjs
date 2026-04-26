import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21P_527EZ_FIXTURE = new URL('../../form-samples/VBA-21P-527EZ-ARE.pdf', import.meta.url);

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

test('VBA 21P-527EZ imports as a curated Veterans Pension workflow', async t => {
  if (!(await fixtureAvailable(FORM_21P_527EZ_FIXTURE))) {
    t.skip('VBA 21P-527EZ sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21P_527EZ_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21P-527EZ-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);
  const signals = qualitySignals(form, importReport);
  const quality = assessImportQuality({
    status: 'ok',
    componentCount: importReport.componentCount,
    validation: importReport.validation,
    curation: importReport.curation,
    qualitySignals: signals,
  });

  assert.equal(importReport.acroFormFieldCount, 519);
  assert.equal(importReport.componentCount, 491);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21p-527ez-veterans-pension-2023-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 491);
  assert.equal(importReport.curation.curatedFieldCount, 491);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);
  assert.equal(signals.needsReview, false);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Evidence checklist',
      'Veteran identity',
      'Veteran contact information',
      'Military service',
      'Pension information',
      'Employment history',
      'Marital status and spouse information',
      'Prior marital history',
      'Dependent children',
      'Income and assets',
      'Unreimbursed medical expenses',
      'Direct deposit information',
      'Certification and signature',
      'Alternate signer',
      'Care facility worksheet',
      'In-home care worksheet',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('spouseSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('child3SocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('assetsOver25000Dollars')?.type, 'radioButton');
  assert.equal(byId('careProviderDTypeOfCare')?.type, 'radioButton');
  assert.equal(byId('financialInstitutionName')?.type, 'textInput');
  assert.equal(byId('claimantSignatureDate')?.type, 'date');
  assert.equal(byId('alternateSignerSignatureDate')?.type, 'date');
  assert.equal(byId('careFacilityProviderSignatureDate')?.type, 'date');
  assert.equal(byId('inHomeCareProviderSignatureDate')?.type, 'date');

  assert.deepEqual(
    byId('careProviderBTypeOfCare')?.responseOptions?.map(option => option.label),
    ['Care facility', 'In-home care attendant'],
  );
  assert.deepEqual(
    byId('incomeSourceKType')?.responseOptions?.map(option => option.label),
    ['Social Security', 'Interest or dividends', 'Civil service', 'Pension or retirement', 'Other'],
  );
  assert.deepEqual(
    byId('directDepositAccountType')?.responseOptions?.map(option => option.label),
    ['Checking', 'Savings', 'No financial institution account'],
  );

  assert.ok(labels.includes('Veteran full name'));
  assert.ok(labels.includes('Claiming special monthly pension'));
  assert.ok(labels.includes('Number of dependent children living with Veteran'));
  assert.ok(labels.includes('Income source K current gross monthly income amount'));
  assert.ok(labels.includes('Medical expense J amount paid amount'));
  assert.ok(labels.includes('Care facility state or country requires licensing'));
  assert.ok(labels.includes('In-home care hours per month'));
});
