import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21P_534EZ_FIXTURE = new URL('../../form-samples/VBA-21P-534EZ-ARE.pdf', import.meta.url);

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

test('VBA 21P-534EZ imports as a curated survivor benefits workflow', async t => {
  if (!(await fixtureAvailable(FORM_21P_534EZ_FIXTURE))) {
    t.skip('VBA 21P-534EZ sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21P_534EZ_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21P-534EZ-ARE.pdf',
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

  assert.equal(importReport.acroFormFieldCount, 626);
  assert.equal(importReport.componentCount, 569);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21p-534ez-survivor-benefits-2025-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 569);
  assert.equal(importReport.curation.curatedFieldCount, 569);
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
      'Claimant identity and contact',
      'Benefit selection',
      'Military service',
      'Marital information',
      'Marital history',
      'Child of Veteran information',
      'D.I.C. information',
      'Special monthly pension or D.I.C.',
      'Income and assets',
      'Medical and final expenses',
      'Direct deposit information',
      'Certification and signature',
      'Witnesses to signature',
      'Alternate signer',
      'Care facility worksheet',
      'In-home care worksheet',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('claimantFullName')?.type, 'textInput');
  assert.equal(byId('claimantSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('claimingAccruedBenefits')?.type, 'checkbox');
  assert.equal(byId('claimingDependencyAndIndemnityCompensation')?.type, 'checkbox');
  assert.equal(byId('claimingSurvivorsPension')?.type, 'checkbox');
  assert.equal(byId('claimantRelationshipToVeteran')?.type, 'radioButton');
  assert.equal(byId('veteranBranchOfService')?.type, 'radioButton');
  assert.equal(byId('veteranWasPrisonerOfWar')?.type, 'radioButton');
  assert.equal(byId('dICClaimType')?.type, 'radioButton');
  assert.equal(byId('financialInstitutionName')?.type, 'textInput');
  assert.equal(byId('routingOrTransitNumber')?.type, 'maskedInput');
  assert.equal(byId('directDepositAccountNumber')?.type, 'maskedInput');
  assert.equal(byId('certificationAndSignatureDateSigned')?.type, 'date');
  assert.equal(byId('alternateSignerDateSigned')?.type, 'date');
  assert.equal(byId('careFacilityWorksheetSignature')?.type, 'textInput');
  assert.equal(byId('careFacilityWorksheetDateSigned')?.type, 'date');
  assert.equal(byId('inHomeCareWorksheetSignature')?.type, 'textInput');
  assert.equal(byId('inHomeCareWorksheetDateSigned')?.type, 'date');
  assert.equal(byId('inHomeCareHoursPerMonth')?.type, 'textInput');

  assert.deepEqual(
    byId('claimantRelationshipToVeteran')?.responseOptions?.map(option => option.label),
    ['Surviving spouse', 'Disabled adult child', 'Child', 'Custodian'],
  );
  assert.deepEqual(
    byId('veteranBranchOfService')?.responseOptions?.map(option => option.label),
    ['Army', 'Navy', 'Marine Corps', 'Air Force', 'Coast Guard', 'Space Force', 'NOAA', 'USPHS'],
  );
  assert.deepEqual(
    byId('dICClaimType')?.responseOptions?.map(option => option.label),
    ['D.I.C.', 'D.I.C. under 38 U.S.C. 1151'],
  );

  assert.ok(labels.includes('Veteran full name'));
  assert.ok(labels.includes('Claimant full name'));
  assert.ok(labels.includes('Claiming Survivors Pension'));
  assert.ok(labels.includes('Claiming Dependency and Indemnity Compensation'));
  assert.ok(labels.includes('Child 1 is biological child'));
  assert.ok(labels.includes('D.I.C. claim type'));
  assert.ok(labels.includes('Income source B current gross monthly income amount'));
  assert.ok(labels.includes('Medical expense E date costs paid month'));
  assert.ok(labels.includes('Financial institution name'));
  assert.ok(labels.includes('Care facility worksheet date signed'));
  assert.ok(labels.includes('In-home care hours per month'));

  const weakLabelPattern = /\b(?:Field|Checkbox(?:yes|no)?|Jf\d|Number Street|Zip Postal|Apt or Unit|State Province|NumberStreet)\b|Child 1[01]\b|Care expense [RSTUVWXYZ]\b/i;
  assert.deepEqual(labels.filter(label => weakLabelPattern.test(label)), []);
});
