import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const NOD_FIXTURE = new URL('./fixtures/pilot/VA-21-0958-NOD-2020.pdf', import.meta.url);

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

test('21-0958 static Notice of Disagreement imports useful numbered draft fields', async t => {
  if (!(await fixtureAvailable(NOD_FIXTURE))) {
    t.skip('21-0958 pilot fixture not present');
    return;
  }

  const bytes = await readFile(NOD_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VA-21-0958-NOD-2020.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(importReport.curation.recipe.recipeId, 'va-21-0958-nod-2020-static');
  assert.equal(importReport.curation.recipe.matchedFieldCount, 14);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.ok(importReport.componentCount >= 10);
  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    ['Claimant information', 'Appeal details', 'Certification'],
  );
  assert.ok(labels.includes("Veteran's full name"));
  assert.ok(labels.includes("Veteran's Social Security number"));
  assert.ok(labels.includes('Preferred mailing address'));
  assert.ok(labels.includes('Board review option'));
  assert.ok(labels.includes('Issues I want to appeal'));
  assert.ok(labels.includes('Signature'));
  assert.ok(labels.includes('Date signed'));
  assert.equal(
    components.find(component => component.label === "Veteran's Social Security number")?.type,
    'maskedInput',
  );

  const boardReview = components.find(component => component.id === 'boardReviewOption');
  assert.deepEqual(
    boardReview?.responseOptions?.map(option => option.label),
    [
      'Direct review by a Veterans Law Judge',
      'Evidence submission reviewed by a Veterans Law Judge',
      'Hearing with a Veterans Law Judge',
    ],
  );
});
