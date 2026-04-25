import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  appendCorpusEntries,
  appendCorpusEntry,
  clearRuntimeAppends,
  exportCorpus,
  loadCorpus,
  loadCorpusVersion,
  runtimeAppendCount,
} from '../src/import/corpus/store.mjs';
import {
  findNearestExemplar,
  jaccard,
  tokenSet,
} from '../src/import/corpus/lookup.mjs';
import { importPdf } from '../src/import/pipeline.mjs';
import { buildSyntheticAcroFormPdf } from './fixtures/syntheticPdf.mjs';

test('seed corpus loads with at least the seeded exemplars', () => {
  clearRuntimeAppends();
  const corpus = loadCorpus();
  assert.ok(corpus.length >= 40, `expected seeded corpus, got ${corpus.length} entries`);
  assert.equal(loadCorpusVersion(), '2026.04');
  const formIds = new Set(corpus.map(e => e.formFingerprint));
  assert.ok(formIds.has('21-4140'));
  assert.ok(formIds.has('27-8832'));
});

test('runtime appends are visible in loadCorpus and clearable', () => {
  clearRuntimeAppends();
  const baseCount = loadCorpus().length;
  appendCorpusEntry({
    exemplarId: 'runtime:test:1',
    labelAfter: 'Synthetic',
    componentTypeAfter: 'textInput',
    formFingerprint: 'test',
    createdAt: '2026-04-25T00:00:00.000Z',
  });
  assert.equal(runtimeAppendCount(), 1);
  assert.equal(loadCorpus().length, baseCount + 1);
  clearRuntimeAppends();
  assert.equal(loadCorpus().length, baseCount);
});

test('appendCorpusEntries adds many at once', () => {
  clearRuntimeAppends();
  const baseCount = loadCorpus().length;
  appendCorpusEntries([
    { exemplarId: 'a', labelAfter: 'A', componentTypeAfter: 'textInput' },
    { exemplarId: 'b', labelAfter: 'B', componentTypeAfter: 'textInput' },
  ]);
  assert.equal(loadCorpus().length, baseCount + 2);
  clearRuntimeAppends();
});

test('exportCorpus returns a versioned bundle with timestamps', () => {
  const bundle = exportCorpus();
  assert.equal(bundle.version, '2026.04');
  assert.match(bundle.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(bundle.entries));
});

test('jaccard returns 1.0 on identical token sets', () => {
  const a = tokenSet('Veteran last name');
  const b = tokenSet('veteran last name');
  assert.equal(jaccard(a, b), 1);
});

test('jaccard returns 0 on disjoint token sets', () => {
  const a = tokenSet('alpha beta gamma');
  const b = tokenSet('omega psi chi');
  assert.equal(jaccard(a, b), 0);
});

test('findNearestExemplar matches identical labels above threshold', () => {
  const corpus = [
    { exemplarId: 'x', labelAfter: 'Email address', componentTypeAfter: 'email' },
    { exemplarId: 'y', labelAfter: 'Phone number', componentTypeAfter: 'phone' },
  ];
  const result = findNearestExemplar({ name: 'email', closestLabel: 'Email address' }, corpus);
  assert.ok(result, 'should match');
  assert.equal(result.exemplar.exemplarId, 'x');
  assert.ok(result.similarity >= 0.7);
});

test('findNearestExemplar returns null below threshold', () => {
  const corpus = [
    { exemplarId: 'x', labelAfter: 'Completely different label', componentTypeAfter: 'textInput' },
  ];
  const result = findNearestExemplar({ name: 'unrelated', closestLabel: 'Other' }, corpus);
  assert.equal(result, null);
});

test('importer reports corpus hits when synthetic fields match seeded exemplars', async () => {
  clearRuntimeAppends();
  const pdfBytes = await buildSyntheticAcroFormPdf();
  const { form, importReport } = await importPdf(pdfBytes, {
    filename: 'synthetic.pdf',
    llmProvider: 'mock',
    useCache: false,
  });

  assert.ok(importReport.corpusEntryCount >= 40);
  // Email + phone + Date of birth label patterns should match seeded exemplars.
  const components = form.chapters.flatMap(c => c.pages.flatMap(p => p.components));
  const matched = components.filter(c => c.provenance?.exemplarId);
  assert.ok(matched.length >= 1, 'expected at least one corpus match');

  // Confirm corpus hit lifted confidence: components with exemplarId have non-zero corpusSimilarity signal.
  for (const component of matched) {
    assert.ok(component.provenance.signals.corpusSimilarity > 0);
  }
});
