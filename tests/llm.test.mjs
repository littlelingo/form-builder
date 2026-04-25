import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyEnrichment, enrichFields } from '../src/import/llm/enricher.mjs';
import { mockProvider } from '../src/import/llm/providers/mock.mjs';
import { listProviders, getProvider, selectProvider } from '../src/import/llm/registry.mjs';

const fields = [
  {
    fieldId: 'f0',
    name: 'VeteranFirstName',
    type: 'text',
    closestLabel: 'First name',
    neighborText: 'First, middle, and last name',
    heuristicType: 'textInput',
    heuristicConfidence: 0.4,
    maxLength: 40,
  },
  {
    fieldId: 'f1',
    name: 'VeteranEmail',
    type: 'text',
    closestLabel: 'Email address',
    neighborText: '',
    heuristicType: 'textInput',
    heuristicConfidence: 0.4,
  },
];

test('listProviders includes ollama, openai-compatible, claude, mock', () => {
  const names = listProviders();
  assert.ok(names.includes('ollama'));
  assert.ok(names.includes('openai-compatible'));
  assert.ok(names.includes('claude'));
  assert.ok(names.includes('mock'));
});

test('getProvider returns named provider, throws on unknown', () => {
  assert.equal(getProvider('mock').name, 'mock');
  assert.throws(() => getProvider('nope'));
});

test('mock provider isAvailable always true', async () => {
  assert.equal(await mockProvider.isAvailable(), true);
});

test('selectProvider with mock returns available=true', async () => {
  const { provider, available } = await selectProvider('mock');
  assert.equal(provider.name, 'mock');
  assert.equal(available, true);
});

test('mockProvider.enrich returns one enriched field per input', async () => {
  const result = await mockProvider.enrich({
    formMetadata: { title: 't', formId: 'tf' },
    fields: [
      { fieldId: 'f0', acroFormName: 'VeteranEmail', heuristicLabel: 'Email address', acroFormType: 'text' },
      { fieldId: 'f1', acroFormName: 'VeteranPhone', heuristicLabel: 'Phone number', acroFormType: 'text' },
    ],
  });
  assert.equal(result.fields.length, 2);
  assert.equal(result.fields[0].fieldId, 'f0');
  assert.equal(result.fields[0].type, 'email');
  assert.equal(result.fields[1].type, 'phone');
});

test('enrichFields with provider=mock + caching disabled produces enriched output', async () => {
  const result = await enrichFields(fields, {
    providerName: 'mock',
    useCache: false,
    pdfHash: 'sha256:test',
    formId: 'test',
  });
  assert.equal(result.provider, 'mock');
  assert.equal(result.reason, 'success');
  assert.ok(result.enriched);
  assert.equal(result.enriched.fields.length, fields.length);
});

test('enrichFields short-circuits when enabled=false', async () => {
  const result = await enrichFields(fields, { enabled: false });
  assert.equal(result.provider, 'disabled');
  assert.equal(result.enriched, null);
});

test('enrichFields gracefully handles unavailable provider', async () => {
  // openai-compatible default URL won't be reachable in tests.
  const result = await enrichFields(fields, {
    providerName: 'openai-compatible',
    useCache: false,
  });
  assert.equal(result.provider, 'openai-compatible');
  // Could be unavailable OR provider-error depending on environment; both acceptable.
  assert.ok(['provider-unavailable', 'provider-error'].includes(result.reason));
  assert.equal(result.enriched, null);
});

test('applyEnrichment overlays enriched fields onto raw fields by fieldId', () => {
  const raw = [
    { fieldId: 'f0', name: 'A' },
    { fieldId: 'f1', name: 'B' },
  ];
  const enriched = {
    fields: [
      { fieldId: 'f0', label: 'Field A', type: 'textInput', classificationCertainty: 0.9 },
      { fieldId: 'f1', label: 'Field B', type: 'email', classificationCertainty: 0.95 },
    ],
  };
  const merged = applyEnrichment(raw, enriched);
  assert.equal(merged[0].enriched.label, 'Field A');
  assert.equal(merged[1].enriched.type, 'email');
});

test('applyEnrichment preserves raw fields when no enrichment', () => {
  const raw = [{ fieldId: 'f0', name: 'A' }];
  const merged = applyEnrichment(raw, null);
  assert.equal(merged[0].name, 'A');
  assert.equal(merged[0].enriched, undefined);
});
