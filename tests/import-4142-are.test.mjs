import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FIXTURE_CANDIDATES = [
  new URL('../../form-samples/VBA-21-4142-ARE.pdf', import.meta.url),
  new URL('../../tests/fixtures/pilot/VBA-21-4142-ARE.pdf', import.meta.url),
  new URL('file:///Users/clint/Downloads/VBA-21-4142-ARE.pdf'),
];

async function resolveFixture() {
  for (const candidate of FIXTURE_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next.
    }
  }
  return null;
}

test('VBA 21-4142 ARE import detects bundled forms and applies curated workflow', async t => {
  const fixture = await resolveFixture();
  if (!fixture) {
    t.skip('VBA-21-4142-ARE fixture not present');
    return;
  }

  const filename = basename(fixture.pathname);
  const bytes = await readFile(fixture);
  const { form, importReport } = await importPdf(bytes, { filename, enrich: false });
  const validation = validateAuthoringForm(form);

  assert.equal(importReport.formInventory?.status, 'multi-form');
  assert.deepEqual(
    importReport.formInventory?.forms.map(item => item.formNumber),
    ['21-4142', '21-4142A'],
  );
  assert.deepEqual(
    importReport.formInventory?.forms.map(item => item.pageRanges),
    [['1-3'], ['4-5']],
  );

  assert.ok(importReport.patterns?.matchedFieldCount > 0);
  assert.ok(importReport.patterns?.coverageRatio > 0.4);

  assert.equal(importReport.curation?.status, 'curated');
  assert.equal(
    importReport.curation?.recipe?.recipeId,
    'va-form-21-4142-4142a-authorization-2024-acroform',
  );
  assert.ok((importReport.curation?.curatedFieldCount || 0) > 20);

  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const treatmentProviders = form.chapters.find(chapter => chapter.id === 'treatmentProviders');
  assert.equal(treatmentProviders?.type, 'listLoop');
  assert.ok((treatmentProviders?.pages?.[0]?.components?.length || 0) >= 3);
});
