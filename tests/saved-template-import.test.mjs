import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSavedTemplateImport } from '../apps/builder/src/lib/savedTemplateImport.js';

const timestamp = '2026-04-25T12:00:00.000Z';

function sectionTemplate(id, label) {
  return {
    id,
    kind: 'section',
    label,
    createdAt: '2026-01-01T00:00:00.000Z',
    component: {
      id: `${id}Section`,
      type: 'sectionGroup',
      label,
      children: [
        {
          id: `${id}Field`,
          type: 'textInput',
          label: `${label} field`,
        },
      ],
    },
  };
}

function resolve(currentTemplates, incomingTemplates, options = {}) {
  return resolveSavedTemplateImport(currentTemplates, incomingTemplates, {
    idPrefix: 'imported',
    importedAt: timestamp,
    ...options,
  });
}

test('renames imported saved templates when labels conflict', () => {
  const existing = sectionTemplate('existing', 'Contact');
  const incoming = sectionTemplate('incoming', 'Contact');

  const { templates, result } = resolve([existing], [incoming], {
    conflictStrategy: 'rename',
  });

  assert.deepEqual(result, {
    importedCount: 1,
    renamedCount: 1,
    replacedCount: 0,
    skippedCount: 0,
  });
  assert.equal(templates[0].id, 'imported-0');
  assert.equal(templates[0].label, 'Contact (imported)');
  assert.equal(templates[0].importedAt, timestamp);
  assert.equal(templates[1].id, 'existing');
});

test('skips imported saved templates when labels conflict and skip is selected', () => {
  const existing = sectionTemplate('existing', 'Contact');
  const incoming = sectionTemplate('incoming', 'Contact');

  const { templates, result } = resolve([existing], [incoming], {
    conflictStrategy: 'skip',
  });

  assert.deepEqual(result, {
    importedCount: 0,
    renamedCount: 0,
    replacedCount: 0,
    skippedCount: 1,
  });
  assert.deepEqual(templates, [existing]);
});

test('replaces the existing saved template when labels conflict and replace is selected', () => {
  const existing = sectionTemplate('existing', 'Contact');
  const incoming = sectionTemplate('incoming', 'Contact');

  const { templates, result } = resolve([existing], [incoming], {
    conflictStrategy: 'replace',
  });

  assert.deepEqual(result, {
    importedCount: 1,
    renamedCount: 0,
    replacedCount: 1,
    skippedCount: 0,
  });
  assert.equal(templates.length, 1);
  assert.equal(templates[0].id, 'imported-0');
  assert.equal(templates[0].label, 'Contact');
});

test('renames duplicate labels inside the same imported library', () => {
  const first = sectionTemplate('first', 'Shared');
  const second = sectionTemplate('second', 'Shared');

  const { templates, result } = resolve([], [first, second]);

  assert.deepEqual(result, {
    importedCount: 2,
    renamedCount: 1,
    replacedCount: 0,
    skippedCount: 0,
  });
  assert.deepEqual(templates.map(template => template.label), [
    'Shared',
    'Shared (imported)',
  ]);
});

test('keeps imported saved-template libraries within the 25-template cap', () => {
  const incoming = Array.from({ length: 26 }, (_, index) =>
    sectionTemplate(`incoming${index}`, `Imported ${index}`),
  );

  const { templates, result } = resolve([], incoming);

  assert.equal(templates.length, 25);
  assert.equal(result.importedCount, 25);
  assert.equal(templates[0].label, 'Imported 0');
  assert.equal(templates[24].label, 'Imported 24');
  assert.equal(templates.some(template => template.label === 'Imported 25'), false);
});
