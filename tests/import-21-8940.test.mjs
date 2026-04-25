import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const TDIU_FIXTURE = new URL(
  '../../form-samples/va-form-21-8940-tdiu_app_2020.pdf',
  import.meta.url,
);

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

test('VA Form 21-8940 TDIU imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(TDIU_FIXTURE))) {
    t.skip('VA Form 21-8940 sample fixture not present');
    return;
  }

  const bytes = await readFile(TDIU_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-form-21-8940-tdiu_app_2020.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21-8940-tdiu-2020-static',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 35);
  assert.equal(importReport.curation.curatedFieldCount, 35);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran information',
      'Disability and medical care',
      'Employment history',
      'Education and training',
      'Certification',
    ],
  );

  assert.ok(labels.includes('Veteran name'));
  assert.ok(labels.includes('Social Security number'));
  assert.ok(labels.includes('Service-connected disability preventing employment'));
  assert.ok(labels.includes('Date last worked full-time'));
  assert.ok(labels.includes('Most ever earned in one year'));
  assert.ok(labels.includes('Employment for the last five years'));
  assert.ok(labels.includes('Have you tried to obtain employment since you became too disabled to work?'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('socialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('preventingDisability')?.type, 'textArea');
  assert.equal(byId('employmentLastFiveYears')?.type, 'textArea');
  assert.equal(byId('doctorCareYesNo')?.type, 'yesNo');
  assert.equal(byId('lastWorkedDate')?.type, 'date');
  assert.equal(byId('mailingAddress')?.type, 'address');
  assert.equal(byId('emailAddress')?.type, 'email');
  assert.equal(byId('telephoneNumber')?.type, 'phone');

  const remarksLabels = components
    .filter(component => /^remarks/i.test(component.id))
    .map(component => component.label);
  assert.equal(remarksLabels.length, 2);
  assert.equal(new Set(remarksLabels).size, 2, 'remarks labels must be unique');

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => label.length > 110), false);
  assert.equal(new Set(labels).size, labels.length, 'all component labels must be unique');
});
