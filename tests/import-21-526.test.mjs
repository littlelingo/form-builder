import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21_526_FIXTURE = new URL(
  '../../form-samples/va-21-526-application-for-benefits_2020.pdf',
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

test('older VA Form 21-526 static disability application imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(FORM_21_526_FIXTURE))) {
    t.skip('older VA Form 21-526 sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21_526_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-21-526-application-for-benefits_2020.pdf',
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
  assert.equal(importReport.componentCount, 57);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21-526-disability-compensation-2020-static',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 57);
  assert.equal(importReport.curation.curatedFieldCount, 57);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran information',
      'Homelessness status',
      'Disability',
      'Military service',
      'Direct deposit',
      'Certification',
    ],
  );

  assert.ok(labels.includes('Current disability or symptoms'));
  assert.ok(labels.includes('VA or military treatment facilities'));
  assert.ok(labels.includes('Do not pay VA compensation in lieu of retired pay'));
  assert.ok(labels.includes('Do not pay VA compensation in lieu of training pay'));
  assert.ok(labels.includes('Received separation or severance pay?'));
  assert.ok(labels.includes('No financial institution account'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('socialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('currentDisabilityOrSymptoms')?.type, 'textArea');
  assert.equal(byId('treatmentFacilities')?.type, 'textArea');
  assert.equal(byId('currentlyHomeless')?.type, 'yesNo');
  assert.equal(byId('everPow')?.type, 'yesNo');
  assert.equal(byId('mailingAddress')?.type, 'address');
  assert.equal(byId('telephoneNumber')?.type, 'phone');
  assert.equal(byId('emailAddress')?.type, 'email');
  assert.equal(byId('dateOfBirth')?.type, 'date');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
});
