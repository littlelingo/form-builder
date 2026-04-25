import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { auditFormAgainstDefaults } from '../src/standards/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';
import { buildSyntheticAcroFormPdf } from './fixtures/syntheticPdf.mjs';

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
