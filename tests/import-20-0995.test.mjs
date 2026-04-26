import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_20_0995_FIXTURE = new URL('../../form-samples/VBA-20-0995-ARE.pdf', import.meta.url);

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

test('VBA 20-0995 imports as a curated supplemental claim workflow', async t => {
  if (!(await fixtureAvailable(FORM_20_0995_FIXTURE))) {
    t.skip('VBA 20-0995 sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_20_0995_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-20-0995-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 144);
  assert.equal(importReport.componentCount, 94);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-20-0995-supplemental-claim-2024-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 94);
  assert.equal(importReport.curation.curatedFieldCount, 94);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Benefit type',
      'Veteran identity',
      'Veteran contact information',
      'Claimant identity',
      'Claimant contact information',
      'Homeless information',
      'Issues for supplemental claim',
      'New and relevant evidence',
      '5103 notice acknowledgment',
      'VHA notification option',
      'Certification and signature',
      'Witnesses to signature',
      'Alternate signer',
      'Power of attorney signature',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('benefitType')?.type, 'radioButton');
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSsn')?.type, 'maskedInput');
  assert.equal(byId('veteranDateOfBirth')?.type, 'date');
  assert.equal(byId('veteranMailingAddress')?.type, 'address');
  assert.equal(byId('claimantSsn')?.type, 'maskedInput');
  assert.equal(byId('claimantRelationship')?.type, 'radioButton');
  assert.equal(byId('currentlyHomelessOrAtRisk')?.type, 'yesNo');
  assert.equal(byId('issue1DecisionNoticeDate')?.type, 'date');
  assert.equal(byId('issue9SpecificIssue')?.type, 'textInput');
  assert.equal(byId('evidenceVaMedicalCenter')?.type, 'checkbox');
  assert.equal(byId('reviewed5103Notice')?.type, 'yesNo');
  assert.equal(byId('vhaNotificationConsent')?.type, 'radioButton');
  assert.equal(byId('claimantSignatureDate')?.type, 'date');

  assert.deepEqual(
    byId('benefitType')?.responseOptions?.map(option => option.label),
    [
      'Compensation',
      'Pension and survivors benefits',
      'Fiduciary',
      'Life insurance',
      'Education',
      'Loan Guaranty',
      'Veteran Readiness and Employment',
      'Veterans Health Administration',
      'National Cemetery Administration',
    ],
  );
  assert.deepEqual(
    byId('claimantRelationship')?.responseOptions?.map(option => option.label),
    ['Spouse', 'Child', 'Fiduciary', 'Parent', 'Other'],
  );
  assert.deepEqual(
    byId('vhaNotificationConsent')?.responseOptions?.map(option => option.label),
    [
      'I consent to have VBA notify VHA about certain upcoming events',
      'I do not consent to have VBA notify VHA about certain upcoming events',
      'I revoke prior consent to have VBA notify VHA about certain upcoming events',
      'Not applicable or not enrolled or registered in VHA health care',
    ],
  );

  assert.ok(labels.includes('Issue 9 VA decision notice date'));
  assert.ok(labels.includes('Private health care provider records'));
  assert.ok(labels.includes('Veteran or claimant signature'));
  assert.ok(labels.includes('Power of attorney or authorized representative signature'));

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => /\b(?:subform|Radio Button List|SPECIFICISSUE|Vafile|Date Day)\b/i.test(label)), false);
  assert.equal(labels.some(label => label.length > 95), false);
});
