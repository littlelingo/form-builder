import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const VA3288_FIXTURE = new URL('../../form-samples/va-form-3288.pdf', import.meta.url);

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

test('VA Form 3288 records release imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(VA3288_FIXTURE))) {
    t.skip('VA Form 3288 sample fixture not present');
    return;
  }

  const bytes = await readFile(VA3288_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-form-3288.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 11);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-3288-records-release-2020-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 11);
  assert.equal(importReport.curation.curatedFieldCount, 11);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Records request',
      'Veteran information',
      'Records to release',
      'Authorization',
      'Form information',
    ],
  );

  assert.ok(labels.includes('VA office address'));
  assert.ok(labels.includes('Veteran name'));
  assert.ok(labels.includes('Claimant name (if different from Veteran)'));
  assert.ok(labels.includes('Social Security number'));
  assert.ok(labels.includes('Recipient name and address'));
  assert.ok(labels.includes('Information to be released'));
  assert.ok(labels.includes('Purpose of release'));
  assert.ok(labels.includes('Date of signature'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('socialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('recipientNameAndAddress')?.type, 'textArea');
  assert.equal(byId('informationToRelease')?.type, 'textArea');
  assert.equal(byId('purposeOfRelease')?.type, 'textArea');
  assert.equal(byId('dateOfSignature')?.type, 'date');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => label.length > 90), false);
});
