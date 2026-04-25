import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21_526_FIXTURE = new URL('../../form-samples/va-21-526-application-for-benefits_2020.pdf', import.meta.url);

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

test('older VA Form 21-526 static import has builder-native label quality', async t => {
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
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'builder-native');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.ok(labels.includes('Current Disability Or Symptoms'));
  assert.ok(labels.includes('VA Or Military Treatment Facilities'));
  assert.ok(labels.includes('Do Not Pay Me VA Compensation In Lieu Of Retired Pay'));
  assert.ok(labels.includes('Do Not Pay Me VA Compensation In Lieu Of Training Pay'));
  assert.ok(labels.includes('Received Separation Or Severance Pay?'));
  assert.ok(labels.includes('No Financial Institution Account'));
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(importReport.componentCount, 57);
});
