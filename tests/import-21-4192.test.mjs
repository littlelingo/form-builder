import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21_4192_FIXTURE = new URL('../../form-samples/va-form-21-4192-request-for-employment-info_2020.pdf', import.meta.url);

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

test('VA Form 21-4192 static employment import has builder-native label quality', async t => {
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
  const byLabel = new Map(components.map(component => [component.label, component]));
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

  assert.ok(labels.includes('Amount Earned During Last 12 Months Of Employment'));
  assert.ok(labels.includes('Reason For Termination Of Employment'));
  assert.ok(labels.includes('Gross Amount Of Last Payment'));
  assert.ok(labels.includes('Was A Lump Sum Payment Made?'));
  assert.ok(labels.includes('Disability Prevents Military Duties?'));
  assert.ok(labels.includes('Receiving Employment-Related Benefits?'));
  assert.ok(labels.includes('Employer Or Supervisor Signature'));
  assert.equal(byLabel.get('Reason For Termination Of Employment')?.type, 'textArea');
  assert.equal(byLabel.get('Was A Lump Sum Payment Made?')?.type, 'yesNo');
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(importReport.componentCount, 30);
});
