import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const SF180_FIXTURE = new URL('../../form-samples/standard-form-180_2020.pdf', import.meta.url);

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

test('SF-180 static records request imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(SF180_FIXTURE))) {
    t.skip('SF-180 sample fixture not present');
    return;
  }

  const bytes = await readFile(SF180_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'standard-form-180_2020.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(importReport.curation.recipe.recipeId, 'sf-180-records-request-2020-static');
  assert.equal(importReport.curation.recipe.matchedFieldCount, 12);
  assert.equal(importReport.curation.curatedFieldCount, 12);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Service member information',
      'Service history',
      'Records request',
      'Requester information',
      'Authorization',
    ],
  );

  const labels = components.map(component => component.label);
  assert.ok(labels.includes('Name used during service'));
  assert.ok(labels.includes('Social Security number'));
  assert.ok(labels.includes('Records being requested'));
  assert.ok(labels.includes('Purpose of request'));
  assert.ok(labels.includes('Requester relationship to service member'));
  assert.ok(labels.includes('Authorization signature'));
  assert.equal(
    components.find(component => component.label === 'Social Security number')?.type,
    'maskedInput',
  );
  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
});
