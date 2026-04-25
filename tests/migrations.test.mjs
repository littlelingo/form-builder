import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CURRENT_SCHEMA_VERSION,
  computeSchemaHash,
  listMigrations,
  runMigrations,
  validateAuthoringForm,
} from '../src/index.mjs';

function readExample(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const v1Form = {
  schemaVersion: '1.0.0',
  formDefinitionVersion: 1,
  formId: 'test-form',
  title: 'Test form',
  chapters: [
    {
      id: 'chapterA',
      title: 'Chapter A',
      pages: [
        {
          id: 'pageA',
          title: 'Page A',
          components: [
            { id: 'fieldA', type: 'textInput', label: 'Field A' },
            {
              id: 'sectionA',
              type: 'sectionGroup',
              label: 'Section A',
              children: [
                { id: 'fieldB', type: 'textInput', label: 'Field B' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test('runMigrations bumps v1.0.0 form to current schema version', async () => {
  const migrated = await runMigrations(v1Form);
  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.schemaVersion, '1.1.0');
});

test('runMigrations stamps default provenance on every component including children', async () => {
  const migrated = await runMigrations(v1Form);
  const [fieldA, sectionA] = migrated.chapters[0].pages[0].components;
  assert.deepEqual(fieldA.provenance, {
    origin: 'hand-authored',
    confidence: 1.0,
    reviewed: true,
  });
  assert.deepEqual(sectionA.provenance, {
    origin: 'hand-authored',
    confidence: 1.0,
    reviewed: true,
  });
  assert.deepEqual(sectionA.children[0].provenance, {
    origin: 'hand-authored',
    confidence: 1.0,
    reviewed: true,
  });
});

test('runMigrations sets lineage with deterministic schemaHash', async () => {
  const migrated = await runMigrations(v1Form);
  assert.equal(typeof migrated.lineage.schemaHash, 'string');
  assert.match(migrated.lineage.schemaHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(migrated.lineage.previousVersion, null);
  assert.equal(migrated.lineage.createdFromVersion, null);

  const again = await runMigrations(v1Form);
  assert.equal(again.lineage.schemaHash, migrated.lineage.schemaHash);
});

test('runMigrations preserves existing provenance on components', async () => {
  const form = {
    ...v1Form,
    chapters: [
      {
        ...v1Form.chapters[0],
        pages: [
          {
            ...v1Form.chapters[0].pages[0],
            components: [
              {
                id: 'fieldA',
                type: 'textInput',
                label: 'Field A',
                provenance: {
                  origin: 'pdf-field',
                  confidence: 0.42,
                  reviewed: false,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const migrated = await runMigrations(form);
  const [fieldA] = migrated.chapters[0].pages[0].components;
  assert.equal(fieldA.provenance.origin, 'pdf-field');
  assert.equal(fieldA.provenance.confidence, 0.42);
  assert.equal(fieldA.provenance.reviewed, false);
});

test('runMigrations is a no-op for forms already at current version', async () => {
  const migrated = await runMigrations(v1Form);
  const again = await runMigrations(migrated);
  assert.equal(again.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(again.lineage.schemaHash, migrated.lineage.schemaHash);
});

test('listMigrations exposes registered version paths', () => {
  const migrations = listMigrations();
  assert.ok(migrations.length >= 1);
  assert.deepEqual(migrations[0], { fromVersion: '1.0.0', toVersion: '1.1.0' });
});

test('computeSchemaHash is stable across object key reorderings', async () => {
  const a = { schemaVersion: '1.1.0', formId: 'x', title: 'y', chapters: [] };
  const b = { chapters: [], title: 'y', formId: 'x', schemaVersion: '1.1.0' };
  assert.equal(await computeSchemaHash(a), await computeSchemaHash(b));
});

test('computeSchemaHash ignores its own lineage.schemaHash field', async () => {
  const a = {
    schemaVersion: '1.1.0',
    formId: 'x',
    title: 'y',
    chapters: [],
    lineage: { previousVersion: null, createdFromVersion: null, schemaHash: '' },
  };
  const b = {
    ...a,
    lineage: { ...a.lineage, schemaHash: 'sha256:differentvalue' },
  };
  assert.equal(await computeSchemaHash(a), await computeSchemaHash(b));
});

test('retro-stamped 21-4140 example still validates and is at current schema version', () => {
  const example = readExample('../examples/21-4140-authoring.json');
  assert.equal(example.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(example.source?.kind, 'manual');
  assert.match(example.lineage?.schemaHash, /^sha256:/);
  const validation = validateAuthoringForm(example);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});

test('retro-stamped 27-8832 example records pdf source and validates', () => {
  const example = readExample('../examples/27-8832-authoring.json');
  assert.equal(example.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(example.source?.kind, 'pdf');
  assert.equal(example.source?.uri, 'fixtures-real/VBA-27-8832-ARE.pdf');
  assert.match(example.lineage?.schemaHash, /^sha256:/);
  const firstField = example.chapters[0].pages[0].components[0];
  assert.equal(firstField.provenance.origin, 'hand-authored');
  assert.equal(firstField.provenance.confidence, 1.0);
  assert.equal(firstField.provenance.reviewed, true);
  const validation = validateAuthoringForm(example);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
});
