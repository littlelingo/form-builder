import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { diffAuthoringForms } from '../src/audit/diff.mjs';

const example = JSON.parse(
  readFileSync(new URL('../examples/21-4140-authoring.json', import.meta.url), 'utf8'),
);

const clone = value => JSON.parse(JSON.stringify(value));

test('classifies content-only label changes as safe', () => {
  const next = clone(example);
  next.chapters[0].pages[0].components[0].label = 'Your email address';

  const diff = diffAuthoringForms(example, next);

  assert.equal(diff.compatibility, 'safe');
  assert.equal(diff.changes[0].code, 'FIELD_LABEL_CHANGED');
});

test('classifies optional new fields as compatible', () => {
  const next = clone(example);
  next.chapters[0].pages[0].components.push({
    id: 'preferredContactTime',
    type: 'textInput',
    label: 'Best time to contact you',
  });

  const diff = diffAuthoringForms(example, next);

  assert.equal(diff.compatibility, 'compatible');
  assert.equal(diff.changes.some(change => change.code === 'FIELD_ADDED'), true);
});

test('classifies removed fields as migration required', () => {
  const next = clone(example);
  next.chapters[0].pages[0].components = next.chapters[0].pages[0].components.filter(
    component => component.id !== 'phone',
  );

  const diff = diffAuthoringForms(example, next);

  assert.equal(diff.compatibility, 'migrationRequired');
  assert.equal(diff.changes.some(change => change.code === 'FIELD_REMOVED'), true);
});

test('classifies list-loop storage path changes as breaking', () => {
  const next = clone(example);
  next.chapters[2].options.arrayPath = 'jobs';

  const diff = diffAuthoringForms(example, next);

  assert.equal(diff.compatibility, 'breaking');
  assert.equal(diff.changes.some(change => change.code === 'LIST_LOOP_ARRAY_PATH_CHANGED'), true);
});
