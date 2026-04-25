import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyComputedValues } from '../src/compiler/computedValues.mjs';
import { evaluateRule } from '../src/compiler/rules.mjs';

test('evaluates nested declarative rules', () => {
  const rule = {
    all: [
      { field: 'employmentType', operator: 'in', value: ['fullTime', 'partTime'] },
      {
        any: [
          { field: 'monthlyIncome', operator: 'greaterThan', value: 0 },
          { field: 'hasEvidence', operator: 'equals', value: true },
        ],
      },
      { not: { field: 'archived', operator: 'equals', value: true } },
    ],
  };

  assert.equal(
    evaluateRule(rule, {
      employmentType: 'fullTime',
      monthlyIncome: 2500,
      hasEvidence: false,
      archived: false,
    }),
    true,
  );
});

test('applies computed values without mutating source form data', () => {
  const formData = { email: 'veteran@example.com', phone: '5551234567' };
  const nextData = applyComputedValues(
    [
      {
        id: 'contactSummary',
        target: 'metadata.contactSummary',
        operation: 'concat',
        sources: ['email', 'phone'],
        separator: ' | ',
      },
    ],
    formData,
  );

  assert.equal(nextData.metadata.contactSummary, 'veteran@example.com | 5551234567');
  assert.equal(formData.metadata, undefined);
});
