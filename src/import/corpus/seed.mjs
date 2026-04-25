#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const corpusPath = resolve(here, 'corrections.json');

const SEED_FORMS = [
  'examples/21-4140-authoring.json',
  'examples/27-8832-authoring.json',
];

function flattenComponents(components = []) {
  const out = [];
  for (const component of components) {
    out.push(component);
    if (Array.isArray(component.children) && component.children.length) {
      out.push(...flattenComponents(component.children));
    }
  }
  return out;
}

function exemplarId(formId, componentId) {
  return `seed:${formId}:${componentId}`;
}

function buildExemplarsFromForm(form) {
  const formId = form.formId;
  const exemplars = [];

  for (const chapter of form.chapters || []) {
    for (const page of chapter.pages || []) {
      for (const component of flattenComponents(page.components || [])) {
        if (!component.id || !component.label) continue;

        const provenance = component.provenance || {};
        const validations = component.validations || [];

        exemplars.push({
          exemplarId: exemplarId(formId, component.id),
          pdfFieldName: provenance.pdfFieldName || null,
          pdfFieldType: provenance.pdfFieldType || null,
          neighborText: [],
          componentTypeBefore: null,
          componentTypeAfter: component.type,
          labelBefore: null,
          labelAfter: component.label,
          hint: component.hint || null,
          validationsAfter: validations,
          required: component.required === true,
          maxLength: typeof component.maxLength === 'number' ? component.maxLength : null,
          autocomplete: component.autocomplete || null,
          formFingerprint: formId,
          chapterId: chapter.id,
          pageId: page.id,
          createdAt: '2026-04-25T00:00:00.000Z',
          createdBy: 'seed',
        });
      }
    }
  }

  return exemplars;
}

const all = SEED_FORMS.flatMap(relPath => {
  const path = resolve(repoRoot, relPath);
  const form = JSON.parse(readFileSync(path, 'utf8'));
  return buildExemplarsFromForm(form);
});

const corpus = {
  version: '2026.04',
  generatedAt: '2026-04-25T00:00:00.000Z',
  generator: 'src/import/corpus/seed.mjs',
  entries: all,
};

writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
console.log(`Seeded ${all.length} exemplars across ${SEED_FORMS.length} forms → ${corpusPath}`);
