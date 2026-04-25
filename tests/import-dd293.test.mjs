import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const DD293_FIXTURE = new URL('../../form-samples/dd-form-293_2020.pdf', import.meta.url);

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

test('DD Form 293 static discharge review imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(DD293_FIXTURE))) {
    t.skip('DD Form 293 sample fixture not present');
    return;
  }

  const bytes = await readFile(DD293_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'dd-form-293_2020.pdf',
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
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'dd-form-293-discharge-review-2020-static',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 31);
  assert.equal(importReport.curation.curatedFieldCount, 31);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    ['Military service', 'Applicant information'],
  );

  const militaryService = form.chapters[0];
  assert.deepEqual(
    militaryService.pages.map(page => page.title),
    [
      'Service identity',
      'Discharge details',
      'Review request',
      'Discharge statements',
      'Supporting documents',
    ],
  );

  assert.ok(labels.includes('Branch at time of inequity or impropriety'));
  assert.ok(labels.includes('Highest education achieved'));
  assert.ok(labels.includes('Discharge inequity statement'));
  assert.ok(labels.includes('Discharge impropriety statement'));
  assert.ok(labels.includes('Documents in support of claim'));
  assert.ok(labels.includes('Applicant signature'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('narrativeReason')?.type, 'textArea');
  assert.equal(byId('dischargeInequity')?.type, 'textArea');
  assert.equal(byId('dischargeImpropriety')?.type, 'textArea');
  assert.equal(byId('mailingAddress')?.type, 'address');
  assert.equal(byId('dischargeDate')?.type, 'date');
  assert.equal(byId('whyChangeRequested')?.type, 'yesNo');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
});
