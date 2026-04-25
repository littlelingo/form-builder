#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../schema/migrations/registry.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '..', '..');

const TARGETS = [
  {
    path: resolve(repoRoot, 'examples/21-4140-authoring.json'),
    source: {
      kind: 'manual',
      importedAt: '2026-04-25T00:00:00.000Z',
      importedBy: 'retro-stamp',
    },
  },
  {
    path: resolve(repoRoot, 'examples/27-8832-authoring.json'),
    source: {
      kind: 'pdf',
      uri: 'fixtures-real/VBA-27-8832-ARE.pdf',
      hash: null,
      importedAt: '2026-04-25T00:00:00.000Z',
      importedBy: 'retro-stamp',
    },
  },
];

for (const target of TARGETS) {
  const original = JSON.parse(readFileSync(target.path, 'utf8'));
  const withSource = original.source
    ? original
    : { ...original, source: target.source };
  // eslint-disable-next-line no-await-in-loop
  const migrated = await runMigrations(withSource);
  writeFileSync(target.path, `${JSON.stringify(migrated, null, 2)}\n`);
  console.log(
    `retro-stamped ${target.path} → schemaVersion=${migrated.schemaVersion} schemaHash=${migrated.lineage.schemaHash}`,
  );
}
