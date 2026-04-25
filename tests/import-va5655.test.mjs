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

test('VA Form 5655 static financial status report imports as a curated workflow', async t => {
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
  assert.equal(importReport.componentCount, 42);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-5655-financial-status-2020-static',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 42);
  assert.equal(importReport.curation.curatedFieldCount, 42);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran information',
      'Household',
      'Income and expenses',
      'Assets',
      'Bankruptcy and certification',
    ],
  );

  assert.ok(labels.includes('Have you ever been adjudicated bankrupt?'));
  assert.ok(labels.includes('Additional financial information'));
  assert.ok(labels.includes('Monthly gross salary'));
  assert.ok(labels.includes('Net monthly income minus expenses'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('socialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('everAdjudicatedBankrupt')?.type, 'yesNo');
  assert.equal(byId('additionalFinancialInformation')?.type, 'textArea');
  assert.equal(byId('realEstateOwned')?.type, 'textArea');
  assert.equal(byId('telephoneNumber')?.type, 'phone');
  assert.equal(byId('address')?.type, 'address');
  assert.equal(byId('dateOfBirth')?.type, 'date');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
});
