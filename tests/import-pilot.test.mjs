import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const pilotPath = `${here}fixtures/pilot/VBA-27-8832-ARE.pdf`;

const pilotAvailable = existsSync(pilotPath);

async function checkOllama() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function structuralAsserts(form, importReport) {
  assert.equal(form.schemaVersion, '1.1.0');
  assert.equal(form.source.kind, 'pdf');
  assert.match(form.source.hash, /^sha256:/);
  assert.ok(importReport.acroFormFieldCount > 0, 'real PDF should yield AcroForm fields');

  const validation = validateAuthoringForm(form);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const components = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
  assert.ok(components.length >= importReport.acroFormFieldCount * 0.5,
    'imported components should track AcroForm field count');
  for (const component of components) {
    assert.equal(component.provenance.origin, 'pdf-field');
    assert.ok(component.provenance.pdfFieldName, 'pdfFieldName should be set');
    assert.ok(component.provenance.confidence >= 0 && component.provenance.confidence <= 1);
  }
}

test('pilot AcroForm import produces a valid authoring form (mock provider)', { skip: !pilotAvailable && 'pilot PDF not present' }, async () => {
  const pdfBytes = readFileSync(pilotPath);
  const { form, importReport } = await importPdf(pdfBytes, {
    filename: 'VBA-27-8832-ARE.pdf',
    formId: '27-8832-imported',
    title: 'Personalized Career Planning and Guidance/Chapter 36 (imported)',
    llmProvider: 'mock',
    useCache: false,
  });
  structuralAsserts(form, importReport);
});

test(
  'pilot AcroForm import via local Ollama provider (gated on local server + IMPORT_RUN_OLLAMA_TESTS=1)',
  {
    skip:
      !pilotAvailable
        ? 'pilot PDF not present'
        : process.env.IMPORT_RUN_OLLAMA_TESTS !== '1'
          ? 'Ollama tests disabled (set IMPORT_RUN_OLLAMA_TESTS=1)'
          : !(await checkOllama())
            ? 'Ollama not reachable on http://localhost:11434'
            : false,
  },
  async () => {
    const pdfBytes = readFileSync(pilotPath);
    const { form, importReport } = await importPdf(pdfBytes, {
      filename: 'VBA-27-8832-ARE.pdf',
      formId: '27-8832-imported-llm',
      title: 'Personalized Career Planning and Guidance/Chapter 36 (imported via Ollama)',
      llmProvider: 'ollama',
      useCache: true,
    });
    structuralAsserts(form, importReport);
    // Ollama may succeed with 'success' or fall back to 'provider-error' on bad batches.
    // Either way, the import should still produce valid authoring JSON.
    assert.ok(['success', 'cache-hit', 'provider-error'].includes(importReport.enrichment.reason));
  },
);

test(
  'pilot AcroForm import via Claude provider (gated on ANTHROPIC_API_KEY + IMPORT_RUN_CLOUD_TESTS)',
  {
    skip:
      !pilotAvailable
        ? 'pilot PDF not present'
        : !process.env.ANTHROPIC_API_KEY || process.env.IMPORT_RUN_CLOUD_TESTS !== '1'
          ? 'cloud tests disabled (set ANTHROPIC_API_KEY + IMPORT_RUN_CLOUD_TESTS=1)'
          : false,
  },
  async () => {
    const pdfBytes = readFileSync(pilotPath);
    const { form, importReport } = await importPdf(pdfBytes, {
      filename: 'VBA-27-8832-ARE.pdf',
      formId: '27-8832-imported-claude',
      title: 'Personalized Career Planning and Guidance/Chapter 36 (imported via Claude)',
      llmProvider: 'claude',
      useCache: true,
    });
    structuralAsserts(form, importReport);
    assert.equal(importReport.enrichment.reason, 'success');
  },
);
