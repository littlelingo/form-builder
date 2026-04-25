import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isDirty, signatureFromForm } from '../apps/builder/src/lib/dirty.ts';

const form = {
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
          components: [{ id: 'a', type: 'textInput', label: 'A' }],
        },
      ],
    },
  ],
};

test('signatureFromForm is stable across key reorderings', () => {
  const a = { ...form };
  const b = {
    chapters: form.chapters,
    title: 'Test',
    formId: 'test',
    schemaVersion: '1.1.0',
  };
  assert.equal(signatureFromForm(a), signatureFromForm(b));
});

test('signatureFromForm changes when content changes', () => {
  const sig1 = signatureFromForm(form);
  const edited = {
    ...form,
    chapters: [
      {
        ...form.chapters[0],
        pages: [
          {
            ...form.chapters[0].pages[0],
            components: [{ id: 'a', type: 'textInput', label: 'A edited' }],
          },
        ],
      },
    ],
  };
  assert.notEqual(sig1, signatureFromForm(edited));
});

test('isDirty returns false when no baseline', () => {
  assert.equal(isDirty(form, null), false);
});

test('isDirty returns false when signatures match', () => {
  const sig = signatureFromForm(form);
  assert.equal(isDirty(form, sig), false);
});

test('isDirty returns true when form differs from saved signature', () => {
  const sig = signatureFromForm(form);
  const edited = { ...form, title: 'Different' };
  assert.equal(isDirty(edited, sig), true);
});
