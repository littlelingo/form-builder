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
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.ok(importReport.componentCount >= 10);
  assert.ok(labels.includes("Veteran's Name"));
  assert.ok(labels.includes("Veteran's Social Security Number"));
  assert.ok(labels.includes('My Preferred Mailing Address'));
  assert.ok(labels.includes('Board Review Option') || labels.includes('Item 11'));
  assert.ok(labels.includes('Signature'));
  assert.ok(labels.includes('Date Signed'));
  assert.equal(
    components.find(component => component.label === "Veteran's Social Security Number")?.type,
    'maskedInput',
  );
});
