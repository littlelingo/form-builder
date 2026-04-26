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

test('VBA 21-526EZ large XFA import is curated into a disability compensation workflow', async t => {
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
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21-526ez-disability-compensation-2026-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 313);
  assert.equal(importReport.curation.curatedFieldCount, 313);
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);
  assert.equal(signals.needsReview, false);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Claim type',
      'Veteran identity',
      'Veteran contact information',
      'Change of address',
      'Homeless information',
      'Toxic exposure information',
      'Disabilities claimed',
      'Treatment information',
      'Military service',
      'Reserve and Guard service',
      'Military pay information',
      'Separation and training pay',
      'Direct deposit information',
      'Certification and signature',
      'Alternate signer and representative',
    ],
  );

  assert.ok(labels.includes('Fully Developed Claim program'));
  assert.ok(labels.includes('Veteran Social Security number'));
  assert.ok(labels.includes('Current mailing address'));
  assert.ok(labels.includes('Claims a toxic exposure condition'));
  assert.ok(labels.includes('Disability 1 current disability'));
  assert.ok(labels.includes('Disability 35 current disability'));
  assert.ok(labels.includes('Treatment record 3 no treatment date available'));
  assert.ok(labels.includes('Branch of service'));
  assert.ok(labels.includes('Account type'));
  assert.ok(labels.includes('Claimant signature'));
  assert.ok(labels.includes('POA or authorized representative signature'));
  assert.equal(labels.some(label => label.length > 90), false);
  assert.equal(importReport.componentCount, 313);
});
