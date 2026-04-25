import assert from 'node:assert/strict';
import { test } from 'node:test';

import { confidenceBand, unreviewedComponentCount } from '../apps/builder/src/lib/reviewState.ts';

const formWithBands = {
  schemaVersion: '1.1.0',
  formId: 'wizard-test',
  title: 'Wizard Test',
  chapters: [
    {
      id: 'c1',
      title: 'C1',
      pages: [
        {
          id: 'p1',
          title: 'P1',
          components: [
            {
              id: 'low1',
              type: 'textInput',
              label: 'Low',
              provenance: { origin: 'pdf-field', confidence: 0.4, reviewed: false },
            },
            {
              id: 'medium1',
              type: 'textInput',
              label: 'Medium',
              provenance: { origin: 'pdf-field', confidence: 0.7, reviewed: false },
            },
            {
              id: 'high1',
              type: 'textInput',
              label: 'High',
              provenance: { origin: 'pdf-field', confidence: 0.95, reviewed: false },
            },
            {
              id: 'reviewed1',
              type: 'textInput',
              label: 'Already reviewed',
              provenance: { origin: 'pdf-field', confidence: 0.4, reviewed: true },
            },
            {
              id: 'handAuthored1',
              type: 'textInput',
              label: 'Hand authored',
              provenance: { origin: 'hand-authored', confidence: 1.0, reviewed: true },
            },
          ],
        },
      ],
    },
  ],
};

test('confidence bands map low/medium/high correctly', () => {
  assert.equal(confidenceBand(0.4), 'low');
  assert.equal(confidenceBand(0.7), 'medium');
  assert.equal(confidenceBand(0.95), 'high');
});

test('unreviewedComponentCount counts only reviewed=false components', () => {
  // low1 + medium1 + high1 unreviewed; reviewed1 + handAuthored1 reviewed
  assert.equal(unreviewedComponentCount(formWithBands), 3);
});
