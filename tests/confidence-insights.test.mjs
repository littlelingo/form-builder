import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConfidenceInsight } from '../apps/builder/src/lib/confidenceInsights.ts';

test('buildConfidenceInsight explains low-confidence signal gaps in plain language', () => {
  const insight = buildConfidenceInsight({
    origin: 'pdf-field',
    confidence: 0.32,
    reviewed: false,
    signals: {
      acroformSignal: 0.4,
      labelDistance: 0.25,
      classificationCertainty: 0.4,
      corpusSimilarity: 0.1,
      validationMatch: 0.35,
    },
  }, {
    label: 'Issue date',
    componentType: 'textInput',
  });

  assert.match(insight.summary, /^Review "Issue date" because /);
  assert.ok(insight.reasons.some(reason => reason.includes('Label match score is 25%')));
  assert.ok(insight.reasons.some(reason => reason.includes('Pattern similarity is 10%')));
  assert.ok(
    insight.reasons.some(reason =>
      reason.includes('field type certainty') ||
      reason.includes('Validation clue score') ||
      reason.includes('PDF field structure score'),
    ),
  );
  assert.equal(insight.checks.length, 3);
});

test('buildConfidenceInsight adds visible-text guidance for static region imports', () => {
  const insight = buildConfidenceInsight({
    origin: 'pdf-static-region',
    confidence: 0.28,
    reviewed: false,
    signals: {
      labelDistance: 0.45,
      classificationCertainty: 0.4,
    },
  }, {
    label: 'Provider name',
    componentType: 'textInput',
  });

  assert.ok(insight.reasons[0].includes('visible PDF text'));
  assert.match(insight.checks[0], /fillable field/i);
});

test('buildConfidenceInsight falls back to concise default messaging when signals are absent', () => {
  const insight = buildConfidenceInsight({
    origin: 'pdf-field',
    confidence: 0.4,
    reviewed: false,
  });

  assert.equal(insight.reasons.length, 1);
  assert.equal(insight.reasons[0], 'Low confidence score (40%) with limited import signals.');
  assert.match(insight.summary, /Low confidence score \(40%\)/i);
  assert.equal(insight.checks.length, 3);
});
