import { computeSchemaHash } from './schemaHash.mjs';

export const fromVersion = '1.0.0';
export const toVersion = '1.1.0';

const DEFAULT_PROVENANCE = {
  origin: 'hand-authored',
  confidence: 1.0,
  reviewed: true,
};

function stampComponentProvenance(component) {
  if (!component || typeof component !== 'object') return component;
  const next = { ...component };
  if (!next.provenance) {
    next.provenance = { ...DEFAULT_PROVENANCE };
  }
  if (Array.isArray(next.children)) {
    next.children = next.children.map(stampComponentProvenance);
  }
  return next;
}

function stampPage(page) {
  if (!page || !Array.isArray(page.components)) return page;
  return { ...page, components: page.components.map(stampComponentProvenance) };
}

function stampChapter(chapter) {
  if (!chapter || !Array.isArray(chapter.pages)) return chapter;
  return { ...chapter, pages: chapter.pages.map(stampPage) };
}

export async function migrate(form) {
  if (!form || typeof form !== 'object') {
    throw new Error('migrate requires a form object');
  }

  const next = {
    ...form,
    schemaVersion: toVersion,
  };

  if (Array.isArray(next.chapters)) {
    next.chapters = next.chapters.map(stampChapter);
  }

  const lineage = {
    previousVersion: null,
    createdFromVersion: null,
    ...(form.lineage || {}),
  };
  next.lineage = { ...lineage, schemaHash: '' };
  next.lineage.schemaHash = await computeSchemaHash(next);

  return next;
}
