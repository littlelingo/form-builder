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

test('DD Form 293 static correction board import has builder-native label quality', async t => {
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
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'builder-native');
  assert.deepEqual(signals.veryLongLabels, []);

  assert.ok(labels.includes('Branch At Time Of Inequity Or Impropriety'));
  assert.ok(labels.includes('Highest Education Achieved'));
  assert.ok(labels.includes('Applicant Signature'));
  assert.ok(labels.includes('Documents In Support Of Claim'));
  assert.ok(labels.includes('Discharge Inequity Statement'));
  assert.ok(labels.includes('Discharge Impropriety Statement'));
  assert.equal(labels.some(label => label.length > 90), false);
  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    ['Military service', 'Applicant information', 'Military service'],
  );
});
