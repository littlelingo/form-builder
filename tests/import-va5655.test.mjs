import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const VA5655_FIXTURE = new URL('../../form-samples/va5655_2020.pdf', import.meta.url);

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

test('VA5655 static financial status import has builder-native label quality', async t => {
  if (!(await fixtureAvailable(VA5655_FIXTURE))) {
    t.skip('VA5655 sample fixture not present');
    return;
  }

  const bytes = await readFile(VA5655_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va5655_2020.pdf',
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

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    ['Financial information'],
  );
  assert.equal(form.chapters[0].pages.length, 2);
  assert.ok(labels.includes('Have You Ever Been Adjudicated Bankrupt?'));
  assert.ok(labels.includes('Additional Financial Information'));
  assert.equal(byLabel.get('Have You Ever Been Adjudicated Bankrupt?')?.type, 'yesNo');
  assert.equal(byLabel.get('Additional Financial Information')?.type, 'textArea');
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(importReport.componentCount, 42);
});
