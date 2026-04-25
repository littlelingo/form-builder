import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_2122A_FIXTURE = new URL('../../form-samples/va-form-21-22a_2020.pdf', import.meta.url);

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

test('VA Form 21-22a static appointment import has builder-native label quality', async t => {
  if (!(await fixtureAvailable(FORM_2122A_FIXTURE))) {
    t.skip('VA Form 21-22a sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_2122A_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-form-21-22a_2020.pdf',
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

  assert.ok(labels.includes("Representative's Access To Protected Records"));
  assert.ok(labels.includes('Limitation Of Consent'));
  assert.ok(labels.includes("Authorization To Change Claimant's Address"));
  assert.ok(labels.includes('Limited One-Time Representation'));
  assert.ok(labels.includes('Limitations On Representation'));
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(importReport.componentCount, 29);
});
