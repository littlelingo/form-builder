import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assessImportQuality,
  qualitySignals,
  REPRESENTATIVE_TARGETS,
} from '../src/cli/import-corpus.mjs';

function formWith({ chapterTitle, pageTitle, components }) {
  return {
    chapters: [
      {
        id: 'chapter',
        title: chapterTitle,
        pages: [
          {
            id: 'page',
            title: pageTitle,
            components,
          },
        ],
      },
    ],
  };
}

function component(id, overrides = {}) {
  return {
    id,
    type: 'textInput',
    label: `Field ${id}`,
    provenance: {
      confidence: 0.9,
      reviewed: false,
      ...overrides.provenance,
    },
    ...overrides,
  };
}

function resultFor(form, overrides = {}) {
  const signals = qualitySignals(form, { validation: { valid: true } });
  const result = {
    status: 'ok',
    componentCount: form.chapters.flatMap(chapter =>
      chapter.pages.flatMap(page => page.components),
    ).length,
    validation: { valid: true },
    curation: { status: 'generic-fallback' },
    qualitySignals: signals,
    ...overrides,
  };
  return {
    ...result,
    quality: assessImportQuality(result),
  };
}

test('corpus quality ladder separates valid generic drafts from structured forms', () => {
  const generic = resultFor(
    formWith({
      chapterTitle: 'Imported form',
      pageTitle: 'Page 1',
      components: [component('one')],
    }),
  );
  assert.equal(generic.quality.level, 'valid');
  assert.match(generic.quality.reasons.join(' '), /generic imported-form\/page structure/);

  const structured = resultFor(
    formWith({
      chapterTitle: 'Veteran information',
      pageTitle: 'Contact details',
      components: [component('one')],
    }),
  );
  assert.equal(structured.quality.level, 'builder-native');
});

test('curated static forms can reach curated quality despite low extraction confidence', () => {
  const curatedForm = formWith({
    chapterTitle: 'Appeal information',
    pageTitle: 'Issue details',
    components: [
      component('one', {
        provenance: {
          confidence: 0.2,
          curation: { source: 'recipe', chapterId: 'appeal', pageId: 'issue' },
        },
      }),
      component('two', {
        provenance: {
          confidence: 0.2,
          curation: { source: 'recipe', chapterId: 'appeal', pageId: 'issue' },
        },
      }),
    ],
  });

  const signals = qualitySignals(curatedForm, { validation: { valid: true } });
  assert.equal(signals.lowConfidenceRatio, 1);
  assert.equal(signals.curatedRatio, 1);
  assert.equal(signals.needsReview, false);

  const result = resultFor(curatedForm, {
    curation: { status: 'curated' },
    qualitySignals: signals,
  });
  assert.equal(result.quality.level, 'curated');
});

test('list-loop grouping can make low-confidence static drafts builder-native', () => {
  const groupedForm = {
    chapters: [
      {
        id: 'treatmentProviders',
        type: 'listLoop',
        title: 'Treatment providers',
        pages: [
          {
            id: 'providerDetails',
            title: 'Provider details',
            components: [
              component('providerName', {
                label: 'Provider or facility name',
                provenance: { confidence: 0.2 },
              }),
              component('dateOfTreatment', {
                label: 'Date of treatment',
                provenance: { confidence: 0.2 },
              }),
            ],
          },
        ],
      },
    ],
  };

  const signals = qualitySignals(groupedForm, { validation: { valid: true } });
  assert.equal(signals.lowConfidenceRatio, 1);
  assert.equal(signals.listLoopCount, 1);
  assert.equal(signals.needsReview, true);

  const result = resultFor(groupedForm, { qualitySignals: signals });
  assert.equal(result.quality.level, 'builder-native');
});

test('representative import targets cover baseline and next-risk form varieties', () => {
  assert.deepEqual(
    REPRESENTATIVE_TARGETS.map(target => target.filename),
    [
      'va9_2020.pdf',
      'VA Form 10-10EZ.pdf',
      'VBA-21-526EZ-ARE.pdf',
      'standard-form-180_2020.pdf',
      'va-form-21-4142_2020.pdf',
      'dd-form-293_2020.pdf',
      'va-form-95-tort-claim_2020.pdf',
      'va-form-21-8940-tdiu_app_2020.pdf',
      'VBA-21P-527EZ-ARE.pdf',
      'VBA-21P-534EZ-ARE.pdf',
      'va-form-3288.pdf',
    ],
  );
  assert.deepEqual(
    REPRESENTATIVE_TARGETS.map(target => target.targetSet),
    [
      'baseline',
      'baseline',
      'baseline',
      'baseline',
      'baseline',
      'next-risk',
      'next-risk',
      'next-risk',
      'next-risk',
      'next-risk',
      'next-risk',
    ],
  );
});
