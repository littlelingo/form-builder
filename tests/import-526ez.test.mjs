import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_526EZ_FIXTURE = new URL('../../form-samples/VBA-21-526EZ-ARE.pdf', import.meta.url);

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

test('VBA 21-526EZ large XFA import has builder-native label quality', async t => {
  if (!(await fixtureAvailable(FORM_526EZ_FIXTURE))) {
    t.skip('VBA 21-526EZ sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_526EZ_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21-526EZ-ARE.pdf',
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

  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'builder-native');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.ok(labels.includes('Do not pay me VA compensation'));
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(importReport.componentCount, 318);
});
