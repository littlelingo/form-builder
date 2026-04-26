import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

import { generateVaFormConfigModule, validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_SAMPLES_DIR = new URL('../../form-samples/', import.meta.url);

async function corpusAvailable(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

function countComponents(form) {
  return allComponents(form).length;
}

function allComponents(form) {
  return form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
}

function structuralSummary(form) {
  return {
    schemaVersion: form.schemaVersion,
    formId: form.formId,
    title: form.title,
    rootUrl: form.rootUrl,
    submitUrl: form.submitUrl,
    chapterIds: form.chapters.map(chapter => chapter.id),
    pageIds: form.chapters.flatMap(chapter => chapter.pages.map(page => page.id)),
    componentIds: form.chapters.flatMap(chapter =>
      chapter.pages.flatMap(page => page.components.map(component => component.id)),
    ),
  };
}

test('curated corpus imports round-trip through builder JSON and generated formConfig', async t => {
  if (!(await corpusAvailable(FORM_SAMPLES_DIR))) {
    t.skip('../form-samples corpus fixture directory not present');
    return;
  }

  const corpusPath = FORM_SAMPLES_DIR.pathname;
  const filenames = (await readdir(FORM_SAMPLES_DIR))
    .filter(filename => filename.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b));

  assert.ok(filenames.length >= 22, 'expected at least the baseline corpus fixture set');

  for (const filename of filenames) {
    const bytes = await readFile(join(corpusPath, filename));
    const { form, importReport } = await importPdf(bytes, {
      filename,
      enrich: false,
    });

    assert.ok(
      ['curated', 'taxonomy-curated'].includes(importReport.curation.status),
      `${filename} should import as curated or taxonomy-curated`,
    );
    assert.equal(
      importReport.validation.valid,
      true,
      `${filename} import validation failed:\n${importReport.validation.errors.join('\n')}`,
    );
    assert.ok(importReport.componentCount > 0, `${filename} should produce components`);
    assert.ok(
      importReport.curation.curatedFieldCount >= importReport.componentCount,
      `${filename} should curate all extracted fields used in builder components`,
    );
    assert.equal(
      allComponents(form).every(component => component.provenance?.curation?.source),
      true,
      `${filename} builder components should retain curation provenance`,
    );
    assert.equal(
      countComponents(form),
      importReport.componentCount,
      `${filename} component count should match the import report`,
    );

    const serialized = `${JSON.stringify(form, null, 2)}\n`;
    const reopened = JSON.parse(serialized);
    assert.deepEqual(reopened, form, `${filename} should not lose data when saved as JSON`);

    const validation = validateAuthoringForm(reopened);
    assert.equal(validation.valid, true, `${filename} re-open validation failed:\n${validation.errors.join('\n')}`);
    assert.deepEqual(
      structuralSummary(reopened),
      structuralSummary(form),
      `${filename} should preserve builder structure after JSON re-open`,
    );

    const generated = generateVaFormConfigModule(reopened, { includeManifestImport: false });
    assert.match(generated, /const formConfig = \{/, `${filename} should generate a formConfig module`);
    assert.match(
      generated,
      new RegExp(`formId: ${JSON.stringify(reopened.formId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `${filename} generated output should include the imported form id`,
    );
  }
});
