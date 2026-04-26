import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const VA95_FIXTURE = new URL('../../form-samples/va-form-95-tort-claim_2020.pdf', import.meta.url);

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

test('VA Form 95 static tort claim imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(VA95_FIXTURE))) {
    t.skip('VA Form 95 sample fixture not present');
    return;
  }

  const bytes = await readFile(VA95_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-form-95-tort-claim_2020.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.formInventory?.status, 'none-detected');
  assert.ok((importReport.patterns?.coverageRatio || 0) >= 0.35);
  assert.ok((importReport.patterns?.roleCounts?.address || 0) >= 3);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(importReport.curation.recipe.recipeId, 'va-form-95-tort-claim-2020-static');
  assert.equal(importReport.curation.recipe.matchedFieldCount, 17);
  assert.equal(importReport.curation.curatedFieldCount, 17);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Claimant information',
      'Incident details',
      'Damages',
      'Signature',
      'Insurance information',
    ],
  );

  assert.ok(labels.includes('Federal agency receiving this claim'));
  assert.ok(labels.includes('Basis of claim'));
  assert.ok(labels.includes('Property damage amount'));
  assert.ok(labels.includes('Personal injury or wrongful death amount'));
  assert.ok(labels.includes('Accident insurance details'));
  assert.ok(labels.includes('Insurer action on claim'));
  assert.ok(labels.includes('Public liability and property damage insurance details'));

  assert.equal(
    components.find(component => component.id === 'basisOfClaim')?.type,
    'textArea',
  );
  assert.equal(
    components.find(component => component.id === 'accidentInsuranceDetails')?.type,
    'textArea',
  );
  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => label.length > 90), false);
});
