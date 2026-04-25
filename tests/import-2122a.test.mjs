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

test('VA Form 21-22a static individual-representative appointment imports as a curated workflow', async t => {
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
  assert.equal(importReport.componentCount, 29);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21-22a-individual-representative-2020-static',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 29);
  assert.equal(importReport.curation.curatedFieldCount, 29);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran information',
      'Claimant information',
      'Representative appointment',
      'Authorization',
    ],
  );

  assert.ok(labels.includes("Representative's access to protected records"));
  assert.ok(labels.includes('Limitation of consent'));
  assert.ok(labels.includes("Authorization to change claimant's address"));
  assert.ok(labels.includes('Limited one-time representation'));
  assert.ok(labels.includes('Limitations on representation'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('veteranEmail')?.type, 'email');
  assert.equal(byId('claimantPhone')?.type, 'phone');
  assert.equal(byId('protectedRecordsAccess')?.type, 'textArea');
  assert.equal(byId('limitedOneTimeRepresentation')?.type, 'yesNo');
  assert.equal(byId('representativeAddress')?.type, 'address');
  assert.equal(byId('veteranDateOfBirth')?.type, 'date');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
});
