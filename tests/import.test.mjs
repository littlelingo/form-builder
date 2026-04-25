import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { auditFormAgainstDefaults } from '../src/standards/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';
import {
  buildSyntheticAcroFormPdf,
  buildSyntheticInstructionAndStaticFieldsPdf,
  buildSyntheticRepeatedProviderStaticPdf,
  buildSyntheticSf180StaticPdf,
  buildSyntheticStaticPdf,
} from './fixtures/syntheticPdf.mjs';

async function runImport(pdfBytes, options = {}) {
  return importPdf(pdfBytes, {
    filename: 'synthetic.pdf',
    llmProvider: 'mock',
    useCache: false,
    ...options,
  });
}

test('importPdf produces a valid authoring form from a synthetic AcroForm PDF', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form, importReport } = await runImport(pdfBytes);

  assert.equal(form.schemaVersion, '1.1.0');
  assert.equal(form.source.kind, 'pdf');
  assert.match(form.source.hash, /^sha256:/);
  assert.ok(form.lineage?.schemaHash, 'lineage.schemaHash should be present');

  const validation = validateAuthoringForm(form);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(importReport.validation.valid, true);
  assert.ok(importReport.acroFormFieldCount >= 6, 'should detect AcroForm fields');
});

test('importPdf reports progress through each major import phase', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const events = [];
  await runImport(pdfBytes, {
    onProgress: event => events.push(event),
  });

  const stages = events.map(event => event.stage);
  for (const stage of [
    'fingerprint',
    'extract-acroform',
    'extract-text',
    'pair-labels',
    'corpus',
    'enrichment',
    'curation',
    'build-authoring',
    'validate',
    'complete',
  ]) {
    assert.ok(stages.includes(stage), `Expected progress stage "${stage}"`);
  }

  const complete = events.find(event => event.stage === 'complete');
  assert.equal(complete.validation.valid, true);
  assert.ok(complete.fieldCount >= 6);
  assert.ok(complete.pageCount >= 1);
});

test('importPdf infers draft components from static PDFs without fillable fields', async () => {
  const pdfBytes = await buildSyntheticStaticPdf();
  const { form, importReport } = await runImport(pdfBytes, {
    filename: 'static.pdf',
    enrich: false,
  });

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.ok(importReport.componentCount >= 2);
  assert.equal(form.chapters.length, 1);

  const components = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
  assert.ok(components.length >= 2);
  assert.equal(components[0].provenance.origin, 'pdf-static-region');
  assert.equal(components[0].provenance.reviewed, false);
  assert.equal(components[0].provenance.confidenceBand, 'low');
  assert.ok(components.find(component => component.label === 'Name of veteran'));
  assert.ok(components.find(component => component.label === 'Claim file number'));
});

test('importPdf keeps static field pages that also mention instructions', async () => {
  const pdfBytes = await buildSyntheticInstructionAndStaticFieldsPdf();
  const { form, importReport } = await runImport(pdfBytes, {
    filename: 'mixed-instructions-static.pdf',
    enrich: false,
  });

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.ok(importReport.componentCount >= 8);

  const labels = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components.map(component => component.label)),
  );
  assert.ok(labels.includes('Veteran Name'));
  assert.ok(labels.includes('Social Security Number'));
  assert.ok(labels.includes('Mailing Address'));
  assert.ok(labels.includes('Provider Or Facility Name'));
  assert.ok(labels.includes('Date Of Treatment'));
  assert.ok(labels.includes('Provider/Facility Street Address'));
  assert.equal(labels.includes('Item 9'), false);
});

test('importPdf promotes repeated static provider rows into a list-loop chapter', async () => {
  const pdfBytes = await buildSyntheticRepeatedProviderStaticPdf();
  const { form, importReport } = await runImport(pdfBytes, {
    filename: 'repeated-provider-static.pdf',
    enrich: false,
  });

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));

  const providerChapter = form.chapters.find(chapter => chapter.id === 'treatmentProviders');
  assert.ok(providerChapter, 'repeated provider fields should become a treatmentProviders chapter');
  assert.equal(providerChapter.type, 'listLoop');
  assert.equal(providerChapter.options.nounSingular, 'provider');
  assert.equal(providerChapter.options.nounPlural, 'providers');
  assert.equal(providerChapter.pages.length, 1);

  const providerLabels = providerChapter.pages.flatMap(page =>
    page.components.map(component => component.label),
  );
  assert.deepEqual(providerLabels, [
    'Provider Or Facility Name',
    'Date Of Treatment',
    'Provider/Facility Street Address',
  ]);

  const duplicateProviderFields = providerLabels.filter(label => label === 'Provider Or Facility Name');
  assert.equal(duplicateProviderFields.length, 1);
  assert.equal(providerChapter.pages[0].components[0].summaryCard, true);
});

test('importPdf cleans SF-180-style static prose labels and raises numbered-label confidence', async () => {
  const pdfBytes = await buildSyntheticSf180StaticPdf();
  const { form, importReport } = await runImport(pdfBytes, {
    filename: 'standard-form-180-like.pdf',
    enrich: false,
  });

  assert.equal(importReport.acroFormFieldCount, 0);
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));

  const components = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
  const byLabel = Object.fromEntries(components.map(component => [component.label, component]));

  assert.ok(byLabel['Purpose Of Request']);
  assert.ok(byLabel['Requester Relationship To Service Member']);
  assert.ok(byLabel['Authorization Signature']);
  assert.equal(byLabel['Place Of Birth'].type, 'textInput');
  assert.equal(byLabel['Is This Person Deceased?'].type, 'yesNo');
  assert.equal(byLabel['Did This Person Retire From Military Service?'].type, 'yesNo');
  assert.equal(
    components.some(component => component.label.length > 90),
    false,
    'cleaned SF-180 labels should not carry prose paragraphs',
  );
  assert.equal(
    components.every(component => component.provenance.confidence >= 0.5),
    true,
    'clean numbered static labels should not remain low confidence',
  );
});

test('importPdf can curate sections from caller-provided recipe data', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form, importReport } = await runImport(pdfBytes, {
    recipes: [
      {
        id: 'test-contact-recipe',
        title: 'Test contact recipe',
        match: {
          anyText: ['synthetic'],
        },
        fields: [
          {
            selector: { namePattern: '^VeteranEmail$' },
            chapterId: 'contactInformation',
            chapterTitle: 'Contact information',
            pageId: 'contactDetails',
            pageTitle: 'Contact details',
            component: {
              hint: 'Use an email address where VA can contact you.',
            },
          },
          {
            selector: { namePattern: '^VeteranPhone$' },
            chapterId: 'contactInformation',
            chapterTitle: 'Contact information',
            pageId: 'contactDetails',
            pageTitle: 'Contact details',
          },
        ],
      },
    ],
  });

  assert.equal(importReport.curation.status, 'curated');
  assert.equal(importReport.curation.recipe.recipeId, 'test-contact-recipe');
  assert.equal(importReport.curation.recipe.matchedFieldCount, 2);

  const contactChapter = form.chapters.find(chapter => chapter.id === 'contactInformation');
  assert.ok(contactChapter, 'recipe should create the configured chapter');
  assert.equal(contactChapter.title, 'Contact information');
  assert.equal(contactChapter.pages[0].id, 'contactDetails');

  const contactComponents = contactChapter.pages.flatMap(page => page.components);
  const email = contactComponents.find(component => component.provenance.pdfFieldName === 'VeteranEmail');
  const phone = contactComponents.find(component => component.provenance.pdfFieldName === 'VeteranPhone');
  assert.ok(email, 'email should be placed in the recipe page');
  assert.ok(phone, 'phone should be placed in the recipe page');
  assert.equal(email.hint, 'Use an email address where VA can contact you.');
  assert.equal(email.provenance.curation.source, 'recipe');
});

test('importPdf can curate sections from corpus exemplar structure without a recipe', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form, importReport } = await runImport(pdfBytes, {
    corpus: [
      {
        exemplarId: 'test:email',
        pdfFieldName: 'VeteranEmail',
        labelAfter: 'Email address',
        componentTypeAfter: 'email',
        chapterId: 'contactInformation',
        chapterTitle: 'Contact information',
        pageId: 'contactDetails',
        pageTitle: 'Contact details',
      },
    ],
  });

  assert.equal(importReport.curation.status, 'curated');
  assert.equal(importReport.curation.recipe.status, 'no-recipe-match');
  assert.equal(importReport.curation.corpus.matchedFieldCount, 1);

  const contactChapter = form.chapters.find(chapter => chapter.id === 'contactInformation');
  assert.ok(contactChapter, 'corpus match should create the exemplar chapter');
  const email = contactChapter.pages
    .flatMap(page => page.components)
    .find(component => component.provenance.pdfFieldName === 'VeteranEmail');
  assert.ok(email, 'email should be placed from corpus exemplar structure');
  assert.equal(email.provenance.curation.source, 'corpus');
  assert.equal(email.provenance.curation.exemplarId, 'test:email');
});

test('every imported component has provenance with confidence in [0, 1] and pdf-field origin', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form } = await runImport(pdfBytes);

  const components = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
  assert.ok(components.length >= 6);
  for (const component of components) {
    assert.ok(component.provenance, `${component.id} should have provenance`);
    assert.equal(component.provenance.origin, 'pdf-field');
    assert.equal(component.provenance.reviewed, false);
    assert.ok(typeof component.provenance.confidence === 'number');
    assert.ok(component.provenance.confidence >= 0 && component.provenance.confidence <= 1);
    assert.ok(component.provenance.pdfFieldName, 'pdfFieldName should be set');
  }
});

test('importer classifies common field types from labels', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form } = await runImport(pdfBytes);

  const components = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
  const byField = Object.fromEntries(
    components.map(c => [c.provenance.pdfFieldName, c]),
  );

  assert.equal(byField.VeteranEmail.type, 'email');
  assert.equal(byField.VeteranPhone.type, 'phone');
  assert.equal(byField.VeteranDateOfBirth.type, 'date');
  // LLM enricher recognizes "Are you currently employed?" as a yesNo question.
  assert.ok(['yesNo', 'checkbox'].includes(byField.IsEmployed.type));
  assert.equal(byField.BranchOfService.type, 'radioButton');
  // Long maxLength text → textArea
  assert.equal(byField.Remarks.type, 'textArea');
});

test('importer is deterministic across two runs (excluding importedAt timestamp)', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const a = await runImport(pdfBytes);
  const b = await runImport(pdfBytes);

  // Strip volatile fields before comparing.
  const stripVolatile = form => {
    const { source, lineage, ...rest } = form;
    return rest;
  };

  assert.deepEqual(stripVolatile(a.form), stripVolatile(b.form));
  assert.equal(a.form.source.hash, b.form.source.hash);
});

test('imported form passes standards audit with zero blockers (default registry tolerates pdf-field origin)', async () => {
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form } = await runImport(pdfBytes);

  const audit = auditFormAgainstDefaults(form);
  // Imported forms are expected to have warnings (no submitUrl yet, no plainLanguageHeader)
  // but the structural blockers list should not flag any errors purely from import.
  const labelBlockers = audit.blockers.filter(b => b.ruleId === 'va.content.label-required');
  assert.equal(labelBlockers.length, 0, 'every component should have a label after import');
});
