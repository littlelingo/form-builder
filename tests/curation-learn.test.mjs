import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reportCandidates } from '../src/cli/curation-learn.mjs';

test('reportCandidates filters by status, component count, and low-confidence ratio', () => {
  const report = {
    results: [
      {
        status: 'ok',
        file: '/tmp/one.pdf',
        componentCount: 25,
        curation: { status: 'taxonomy-curated' },
        qualitySignals: { lowConfidenceRatio: 0.08 },
      },
      {
        status: 'ok',
        file: '/tmp/two.pdf',
        componentCount: 25,
        curation: { status: 'taxonomy-curated' },
        qualitySignals: { lowConfidenceRatio: 0.21 },
      },
      {
        status: 'ok',
        file: '/tmp/three.pdf',
        componentCount: 0,
        curation: { status: 'taxonomy-curated' },
        qualitySignals: { lowConfidenceRatio: 0.02 },
      },
      {
        status: 'ok',
        file: '/tmp/four.pdf',
        componentCount: 17,
        curation: { status: 'curated' },
        qualitySignals: { lowConfidenceRatio: 0.01 },
      },
      {
        status: 'error',
        file: '/tmp/five.pdf',
        componentCount: 11,
        curation: { status: 'taxonomy-curated' },
        qualitySignals: { lowConfidenceRatio: 0.01 },
      },
    ],
  };

  const selected = reportCandidates(report, {
    statuses: ['taxonomy-curated'],
    minComponents: 1,
    maxLowConfidenceRatio: 0.12,
  });
  assert.deepEqual(selected.map(item => item.file), ['/tmp/one.pdf']);
});

