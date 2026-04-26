import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  assessImportQuality,
  DEFAULT_PATTERN_GATE_PROFILE,
  DEFAULT_MIN_PATTERN_COVERAGE,
  evaluateCorpusGates,
  listPdfFiles,
  PATTERN_GATE_PROFILES,
  qualitySignals,
  REPRESENTATIVE_TARGETS,
  resolveCorpusInput,
  resolveGateConfig,
  summarizeCorpus,
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
      'VBA-21P-535-ARE.pdf',
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
      'next-risk',
    ],
  );
});

test('corpus quality gate fails when pattern coverage falls below threshold', () => {
  const summary = {
    patternCoverageRatio: 0.34,
    worstDecilePatternCoverage: 0.34,
    patternCoverageByExtractionKind: { static: 0.34, acroform: 0.34 },
  };
  const gates = evaluateCorpusGates(summary, {
    gateProfile: 'legacy',
    minPatternCoverage: 0.5,
  });
  assert.equal(gates.passed, false);
  assert.equal(gates.checks.length, 1);
  assert.equal(gates.checks[0].key, 'patternCoverage');
  assert.equal(gates.checks[0].passed, false);
});

test('pattern gate profiles tighten from phase-a through phase-f', () => {
  const phaseA = PATTERN_GATE_PROFILES['phase-a'];
  const phaseB = PATTERN_GATE_PROFILES['phase-b'];
  const phaseC = PATTERN_GATE_PROFILES['phase-c'];
  const phaseD = PATTERN_GATE_PROFILES['phase-d'];
  const phaseE = PATTERN_GATE_PROFILES['phase-e'];
  const phaseF = PATTERN_GATE_PROFILES['phase-f'];

  assert.ok(phaseA.minPatternCoverage < phaseB.minPatternCoverage);
  assert.ok(phaseB.minPatternCoverage < phaseC.minPatternCoverage);
  assert.ok(phaseC.minPatternCoverage < phaseD.minPatternCoverage);
  assert.ok(phaseD.minPatternCoverage < phaseE.minPatternCoverage);
  assert.ok(phaseE.minPatternCoverage < phaseF.minPatternCoverage);

  assert.ok(phaseA.minPatternWorstDecile < phaseB.minPatternWorstDecile);
  assert.ok(phaseB.minPatternWorstDecile < phaseC.minPatternWorstDecile);
  assert.ok(phaseC.minPatternWorstDecile < phaseD.minPatternWorstDecile);
  assert.ok(phaseD.minPatternWorstDecile < phaseE.minPatternWorstDecile);
  assert.ok(phaseE.minPatternWorstDecile < phaseF.minPatternWorstDecile);

  assert.ok(phaseA.minPatternFamilyStatic < phaseB.minPatternFamilyStatic);
  assert.ok(phaseB.minPatternFamilyStatic < phaseC.minPatternFamilyStatic);
  assert.ok(phaseC.minPatternFamilyStatic < phaseD.minPatternFamilyStatic);
  assert.ok(phaseD.minPatternFamilyStatic < phaseE.minPatternFamilyStatic);
  assert.ok(phaseE.minPatternFamilyStatic < phaseF.minPatternFamilyStatic);

  assert.ok(phaseA.minPatternFamilyAcroform < phaseB.minPatternFamilyAcroform);
  assert.ok(phaseB.minPatternFamilyAcroform < phaseC.minPatternFamilyAcroform);
  assert.ok(phaseC.minPatternFamilyAcroform < phaseD.minPatternFamilyAcroform);
  assert.ok(phaseD.minPatternFamilyAcroform < phaseE.minPatternFamilyAcroform);
  assert.ok(phaseE.minPatternFamilyAcroform < phaseF.minPatternFamilyAcroform);

  assert.equal(DEFAULT_PATTERN_GATE_PROFILE, 'phase-e');
});

test('corpus quality gate defaults to minimum threshold and can be disabled', () => {
  const phaseDefaults = PATTERN_GATE_PROFILES[DEFAULT_PATTERN_GATE_PROFILE];
  const summary = {
    patternCoverageRatio: phaseDefaults.minPatternCoverage + 0.01,
    worstDecilePatternCoverage: phaseDefaults.minPatternWorstDecile + 0.01,
    patternCoverageByExtractionKind: {
      static: phaseDefaults.minPatternFamilyStatic + 0.01,
      acroform: phaseDefaults.minPatternFamilyAcroform + 0.01,
    },
  };
  const defaultGates = evaluateCorpusGates(summary);
  assert.equal(defaultGates.passed, true);
  assert.equal(defaultGates.checks.length, 4);

  const disabled = evaluateCorpusGates(summary, { patternGateEnabled: false });
  assert.equal(disabled.passed, true);
  assert.equal(disabled.checks.length, 0);
});

test('resolveGateConfig merges profile defaults with explicit overrides', () => {
  const config = resolveGateConfig({
    gateProfile: 'phase-b',
    minPatternCoverage: 0.81,
    minPatternFamilyStatic: 0.79,
  });
  assert.equal(config.gateProfile, 'phase-b');
  assert.equal(config.minPatternCoverage, 0.81);
  assert.equal(config.minPatternWorstDecile, PATTERN_GATE_PROFILES['phase-b'].minPatternWorstDecile);
  assert.equal(config.minPatternFamilyStatic, 0.79);
  assert.equal(config.minPatternFamilyAcroform, PATTERN_GATE_PROFILES['phase-b'].minPatternFamilyAcroform);
  assert.equal(DEFAULT_MIN_PATTERN_COVERAGE, PATTERN_GATE_PROFILES[DEFAULT_PATTERN_GATE_PROFILE].minPatternCoverage);
});

test('listPdfFiles supports recursive search', () => {
  const root = mkdtempSync(join(tmpdir(), 'import-corpus-recursive-'));
  try {
    mkdirSync(join(root, 'nested'));
    writeFileSync(join(root, 'root.pdf'), 'pdf');
    writeFileSync(join(root, 'nested', 'child.pdf'), 'pdf');
    writeFileSync(join(root, 'nested', 'ignore.txt'), 'txt');

    const flat = listPdfFiles(root, null, { recursive: false });
    assert.equal(flat.length, 1);
    assert.equal(flat[0].endsWith('root.pdf'), true);

    const recursive = listPdfFiles(root, null, { recursive: true });
    assert.equal(recursive.length, 2);
    assert.equal(recursive.some(file => file.endsWith('root.pdf')), true);
    assert.equal(recursive.some(file => file.endsWith('child.pdf')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resolveCorpusInput merges manifest entries, tags, and missing-path warnings', () => {
  const root = mkdtempSync(join(tmpdir(), 'import-corpus-manifest-'));
  try {
    const poolA = join(root, 'pool-a');
    const poolB = join(root, 'pool-b');
    mkdirSync(poolA);
    mkdirSync(poolB);
    writeFileSync(join(poolA, 'alpha.pdf'), 'pdf');
    writeFileSync(join(poolB, 'alpha.pdf'), 'pdf');
    writeFileSync(join(poolB, 'beta.pdf'), 'pdf');

    const manifestPath = join(root, 'manifest.json');
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          name: 'test-pool',
          entries: [
            { path: './pool-a', required: true, tags: ['baseline', 'shared'] },
            { path: './pool-b', required: true, tags: ['expanded', 'shared'] },
            { path: './missing-pool', required: false, tags: ['missing'] },
          ],
        },
        null,
        2,
      ),
    );

    const resolved = resolveCorpusInput({ manifest: manifestPath });
    assert.equal(resolved.source.type, 'manifest');
    assert.equal(resolved.source.name, 'test-pool');
    assert.equal(resolved.files.length, 3);
    assert.equal(resolved.warnings.length, 1);
    assert.match(resolved.warnings[0], /missing manifest path/i);

    const alphaEntries = resolved.files.filter(entry => entry.filePath.endsWith('alpha.pdf'));
    assert.equal(alphaEntries.length, 2);
    for (const alpha of alphaEntries) {
      assert.ok(alpha.tags.includes('shared'));
      assert.ok(alpha.tags.includes('baseline') || alpha.tags.includes('expanded'));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('summarizeCorpus excludes zero-field forms from worst-decile and lowest-coverage rankings', () => {
  const base = {
    status: 'ok',
    acroFormFieldCount: 1,
    componentCount: 1,
    poolTags: [],
    curation: { status: 'generic-fallback' },
    quality: { level: 'builder-native', rank: 4 },
    qualitySignals: {
      curatedCount: 0,
      needsReview: false,
      lowConfidenceRatio: 0,
      genericChapters: [],
      genericPages: [],
      duplicateLabels: [],
      veryLongLabels: [],
    },
  };
  const summary = summarizeCorpus([
    {
      ...base,
      filename: 'zero.pdf',
      patterns: {
        matchedFieldCount: 0,
        totalFieldCount: 0,
        coverageRatio: 0,
        sourceCounts: { deterministic: 0, semantic: 0 },
      },
    },
    {
      ...base,
      filename: 'low.pdf',
      patterns: {
        matchedFieldCount: 8,
        totalFieldCount: 10,
        coverageRatio: 0.8,
        sourceCounts: { deterministic: 8, semantic: 0 },
      },
    },
    {
      ...base,
      filename: 'high.pdf',
      patterns: {
        matchedFieldCount: 10,
        totalFieldCount: 10,
        coverageRatio: 1,
        sourceCounts: { deterministic: 10, semantic: 0 },
      },
    },
  ]);

  assert.equal(summary.worstDecile.length, 1);
  assert.equal(summary.worstDecile[0].filename, 'low.pdf');
  assert.equal(summary.worstDecilePatternCoverage, 0.8);
  assert.equal(summary.lowestPatternCoverage.some(item => item.filename === 'zero.pdf'), false);
});
