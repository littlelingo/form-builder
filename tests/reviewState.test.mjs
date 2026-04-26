import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  acceptComponent,
  rejectComponent,
  importedComponentCount,
  needsHumanReview,
  unreviewedComponentCount,
  confidenceBand,
} from '../apps/builder/src/lib/reviewState.ts';

const baseForm = {
  schemaVersion: '1.1.0',
  formId: 'test',
  title: 'Test',
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
              id: 'a',
              type: 'textInput',
              label: 'A',
              provenance: { origin: 'pdf-field', confidence: 0.4, reviewed: false },
            },
            {
              id: 'b',
              type: 'textInput',
              label: 'B',
              provenance: { origin: 'pdf-field', confidence: 0.9, reviewed: false },
            },
          ],
        },
      ],
    },
  ],
};

test('confidenceBand classifies correctly', () => {
  assert.equal(confidenceBand(0.9), 'high');
  assert.equal(confidenceBand(0.7), 'medium');
  assert.equal(confidenceBand(0.5), 'low');
  assert.equal(confidenceBand(undefined), 'low');
});

test('acceptComponent marks component reviewed without affecting siblings', () => {
  const next = acceptComponent(baseForm, 'a', 'tester');
  const [a, b] = next.chapters[0].pages[0].components;
  assert.equal(a.provenance.reviewed, true);
  assert.equal(a.provenance.lastCorrectedBy, 'tester');
  assert.equal(b.provenance.reviewed, false);
});

test('rejectComponent flips reviewed back to false', () => {
  const accepted = acceptComponent(baseForm, 'a');
  const rejected = rejectComponent(accepted, 'a');
  const [a] = rejected.chapters[0].pages[0].components;
  assert.equal(a.provenance.reviewed, false);
});

test('unreviewedComponentCount counts components with reviewed=false', () => {
  assert.equal(unreviewedComponentCount(baseForm), 2);
  const accepted = acceptComponent(baseForm, 'a');
  assert.equal(unreviewedComponentCount(accepted), 1);
});

test('recipe-curated components do not require human review by default', () => {
  const recipeCurated = {
    ...baseForm,
    chapters: [
      {
        ...baseForm.chapters[0],
        pages: [
          {
            ...baseForm.chapters[0].pages[0],
            components: [
              {
                ...baseForm.chapters[0].pages[0].components[0],
                provenance: {
                  ...baseForm.chapters[0].pages[0].components[0].provenance,
                  curation: {
                    source: 'recipe',
                    recipeId: 'known-form-recipe',
                  },
                },
              },
              baseForm.chapters[0].pages[0].components[1],
            ],
          },
        ],
      },
    ],
  };

  const [curated, generic] = recipeCurated.chapters[0].pages[0].components;
  assert.equal(needsHumanReview(curated), false);
  assert.equal(needsHumanReview(generic), true);
  assert.equal(unreviewedComponentCount(recipeCurated), 1);
});

test('importedComponentCount keeps reviewed PDF imports addressable', () => {
  const accepted = acceptComponent(baseForm, 'a');
  assert.equal(importedComponentCount(accepted), 2);
});

test('importedComponentCount includes static-region child components', () => {
  const form = {
    ...baseForm,
    chapters: [
      {
        ...baseForm.chapters[0],
        pages: [
          {
            ...baseForm.chapters[0].pages[0],
            components: [
              {
                id: 'group',
                type: 'section',
                label: 'Group',
                children: [
                  {
                    id: 'static1',
                    type: 'textInput',
                    label: 'Static inferred field',
                    provenance: { origin: 'pdf-static-region', confidence: 0.8, reviewed: true },
                  },
                  {
                    id: 'manual1',
                    type: 'textInput',
                    label: 'Manual field',
                    provenance: { origin: 'hand-authored', confidence: 1, reviewed: true },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  assert.equal(importedComponentCount(form), 1);
});
