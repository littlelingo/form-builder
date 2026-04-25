import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  compileAuthoringForm,
  generateVaFormConfigModule,
  validateAuthoringForm,
} from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const VA_4142_FIXTURE = new URL('../../form-samples/va-form-21-4142_2020.pdf', import.meta.url);

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

test('VA Form 21-4142 imports as a curated authorization workflow with provider list loop', async t => {
  if (!(await fixtureAvailable(VA_4142_FIXTURE))) {
    t.skip('VA Form 21-4142 sample fixture not present');
    return;
  }

  const bytes = await readFile(VA_4142_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'va-form-21-4142_2020.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);
  const providerChapter = form.chapters.find(chapter => chapter.id === 'treatmentProviders');

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(importReport.curation.recipe.recipeId, 'va-form-21-4142-authorization-2020-static');
  assert.equal(importReport.curation.recipe.matchedFieldCount, 12);
  assert.equal(importReport.curation.curatedFieldCount, 12);
  assert.equal(importReport.componentCount, 9);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran information',
      'Patient information',
      'Treatment providers',
    ],
  );
  assert.equal(providerChapter?.type, 'listLoop');
  assert.deepEqual(providerChapter?.options, {
    nounSingular: 'provider',
    nounPlural: 'providers',
    arrayPath: 'treatmentProviders',
    required: false,
    maxItems: 20,
  });
  assert.equal(providerChapter?.itemNameLabel, 'Provider or facility name');
  assert.equal(providerChapter?.sectionIntro, 'Add each provider or facility VA may request records from.');

  assert.deepEqual(
    providerChapter.pages[0].components.map(component => component.id),
    ['providerName', 'datesOfTreatment', 'providerFacilityAddress'],
  );
  assert.deepEqual(
    providerChapter.pages[0].components.map(component => component.label),
    [
      'Provider or facility name',
      'Dates of treatment',
      'Provider or facility street address',
    ],
  );
  assert.equal(providerChapter.pages[0].components[0].summaryCard, true);

  assert.ok(labels.includes("Veteran's name"));
  assert.ok(labels.includes('Social Security number'));
  assert.ok(labels.includes('VA file number'));
  assert.ok(labels.includes("Patient's name"));
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(components.every(component => component.provenance.curation?.source === 'recipe'), true);

  const compiled = compileAuthoringForm(form);
  assert.ok(compiled.chapters.some(chapter => chapter.type === 'listLoop'));
  assert.ok(generateVaFormConfigModule(form).includes('arrayBuilderPages'));
});
