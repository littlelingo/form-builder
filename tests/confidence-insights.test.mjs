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
  });

  assert.match(insight.summary, /^Review this field because /);
  assert.ok(insight.reasons.includes('Nearby PDF text was unclear.'));
  assert.ok(insight.reasons.includes('No close match from past imports was found.'));
  assert.ok(
    insight.reasons.some(reason =>
      reason === 'The field type may need checking.' ||
      reason === 'Required and format clues were limited.' ||
      reason === 'The PDF field structure gave weak clues.',
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
  });

  assert.ok(insight.reasons[0].includes('visible PDF text'));
  assert.equal(insight.checks[0], 'Confirm this should be a fillable field.');
});

test('buildConfidenceInsight falls back to concise default messaging when signals are absent', () => {
  const insight = buildConfidenceInsight({
    origin: 'pdf-field',
    confidence: 0.4,
    reviewed: false,
  });

  assert.equal(insight.reasons.length, 1);
  assert.equal(insight.reasons[0], 'There were limited clues in the PDF for this field.');
  assert.match(insight.summary, /limited clues in the PDF/i);
  assert.equal(insight.checks.length, 3);
});
