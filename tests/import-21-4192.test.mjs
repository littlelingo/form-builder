import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21_4192_FIXTURE = new URL(
  '../../form-samples/va-form-21-4192-request-for-employment-info_2020.pdf',
  import.meta.url,
);

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

test('VA Form 21-4192 static employer information request imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(FORM_21_4192_FIXTURE))) {
    t.skip('VA Form 21-4192 sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21_4192_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-form-21-4192-request-for-employment-info_2020.pdf',
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

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.componentCount, 30);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21-4192-employer-information-2020-static',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 30);
  assert.equal(importReport.curation.curatedFieldCount, 30);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Employer information',
      'Veteran information',
      'Employment record',
      'Termination',
      'Employment-related benefits',
      'Certification',
    ],
  );

  assert.ok(labels.includes('Amount earned during last 12 months of employment'));
  assert.ok(labels.includes('Reason for termination of employment'));
  assert.ok(labels.includes('Gross amount of last payment'));
  assert.ok(labels.includes('Was a lump sum payment made?'));
  assert.ok(labels.includes('Disability prevents military duties?'));
  assert.ok(labels.includes('Receiving employment-related benefits?'));
  assert.ok(labels.includes('Employer or supervisor signature'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('reasonForTermination')?.type, 'textArea');
  assert.equal(byId('lumpSumPaymentMade')?.type, 'yesNo');
  assert.equal(byId('disabilityPreventsMilitaryDuties')?.type, 'yesNo');
  assert.equal(byId('receivingEmploymentBenefits')?.type, 'yesNo');
  assert.equal(byId('socialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('employerNameAndAddress')?.type, 'textArea');
  assert.equal(byId('employerMailingAddress')?.type, 'address');
  assert.equal(byId('beginningDate')?.type, 'date');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
});
