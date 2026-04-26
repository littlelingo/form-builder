import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const CAREER_GUIDANCE_FIXTURE = new URL(
  'fixtures/pilot/VBA-27-8832-ARE.pdf',
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

test('VA Form 27-8832 career guidance imports as a curated workflow', async t => {
  if (!(await fixtureAvailable(CAREER_GUIDANCE_FIXTURE))) {
    t.skip('VA Form 27-8832 pilot fixture not present');
    return;
  }

  const bytes = await readFile(CAREER_GUIDANCE_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-27-8832-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);

  assert.equal(importReport.acroFormFieldCount, 77);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-27-8832-career-guidance-2023-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 36);
  assert.equal(importReport.curation.curatedFieldCount, 36);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Veteran or service member identity',
      'Veteran or service member contact information',
      'School or training attendance',
      'Military service',
      'Claimant identity',
      'Claimant contact information',
      'Remarks',
      'Certification and signature',
    ],
  );

  assert.deepEqual(
    form.chapters.find(chapter => chapter.id === 'militaryService').pages.map(page => page.title),
    ['Military service dates', 'Military service details'],
  );
  assert.deepEqual(
    form.chapters.find(chapter => chapter.id === 'certification').pages.map(page => page.title),
    ['Certification', 'Parent, guardian, or custodian signature'],
  );

  assert.ok(labels.includes("Veteran or service member's full name"));
  assert.ok(labels.includes("Veteran or service member's Social Security number"));
  assert.ok(labels.includes("Veteran or service member's mailing address"));
  assert.ok(labels.includes('Is the Veteran or service member currently attending a school or training facility?'));
  assert.ok(labels.includes('Branch of service'));
  assert.ok(labels.includes('Character of discharge'));
  assert.ok(labels.includes('Relationship to Veteran'));
  assert.ok(labels.includes('Claimant mailing address'));
  assert.ok(labels.includes('Remarks'));
  assert.ok(labels.includes('Veteran, service member, or claimant typed signature'));
  assert.ok(labels.includes('Alternate signer relationship'));

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranSsn')?.type, 'maskedInput');
  assert.equal(byId('veteranDateOfBirth')?.type, 'date');
  assert.equal(byId('veteranMailingAddress')?.type, 'address');
  assert.equal(byId('veteranPhone')?.type, 'phone');
  assert.equal(byId('veteranEmail')?.type, 'email');
  assert.equal(byId('veteranAttendingSchool')?.type, 'yesNo');
  assert.equal(byId('activeDutyEnteredDate')?.type, 'date');
  assert.equal(byId('branchOfService')?.type, 'radioButton');
  assert.equal(byId('claimantFullName')?.type, 'textInput');
  assert.equal(byId('claimantDateOfBirth')?.type, 'date');
  assert.equal(byId('claimantRelationship')?.type, 'radioButton');
  assert.equal(byId('remarks')?.type, 'textArea');
  assert.equal(byId('applicantSignatureDate')?.type, 'date');
  assert.equal(byId('alternateSignerType')?.type, 'radioButton');
  assert.equal(byId('alternateSignerPhone')?.type, 'phone');

  assert.deepEqual(
    byId('branchOfService')?.responseOptions?.map(option => option.label),
    ['Army', 'Navy', 'Marine Corps', 'Air Force', 'Coast Guard', 'Space Force', 'NOAA', 'USPHS'],
  );
  assert.deepEqual(
    byId('alternateSignerType')?.responseOptions?.map(option => option.label),
    ['Parent', 'Guardian', 'Custodian'],
  );

  assert.equal(
    components.every(component => component.provenance.curation?.source === 'recipe'),
    true,
  );
  assert.equal(labels.some(label => /\b(?:subform|SignatureField|NumberAndStreet|LastFourNumbers)\b/i.test(label)), false);
  assert.equal(labels.some(label => label.length > 95), false);
});
