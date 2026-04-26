#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { argv, exit, stderr, stdout } from 'node:process';

import { importPdf } from '../import/pipeline.mjs';

export const QUALITY_LEVELS = [
  { level: 'failed', rank: 0, label: 'Failed' },
  { level: 'raw', rank: 1, label: 'Raw' },
  { level: 'valid', rank: 2, label: 'Valid' },
  { level: 'structured', rank: 3, label: 'Structured' },
  { level: 'builder-native', rank: 4, label: 'Builder-native' },
  { level: 'curated', rank: 5, label: 'Curated' },
];

const QUALITY_RANKS = Object.fromEntries(QUALITY_LEVELS.map(({ level, rank }) => [level, rank]));

export const REPRESENTATIVE_TARGETS = [
  {
    filename: 'va9_2020.pdf',
    targetSet: 'baseline',
    category: 'curated-static-baseline',
    targetLevel: 'curated',
    focus: 'Static form that should remain fully curated and sectioned.',
  },
  {
    filename: 'VA Form 10-10EZ.pdf',
    targetSet: 'baseline',
    category: 'medium-acroform-baseline',
    targetLevel: 'curated',
    focus: 'Moderate AcroForm coverage should remain fully curated into health-benefits sections.',
  },
  {
    filename: 'VBA-21-526EZ-ARE.pdf',
    targetSet: 'baseline',
    category: 'large-xfa-stress-case',
    targetLevel: 'curated',
    focus: 'Large XFA/AcroForm disability-compensation form should remain fully curated into claim, Veteran, disability, service, payment, and signature sections.',
  },
  {
    filename: 'standard-form-180_2020.pdf',
    targetSet: 'baseline',
    category: 'noisy-static-text',
    targetLevel: 'builder-native',
    focus: 'Noisy static text cleanup: labels, types, and non-field prose.',
  },
  {
    filename: 'va-form-21-4142_2020.pdf',
    targetSet: 'baseline',
    category: 'repeating-provider-group',
    targetLevel: 'builder-native',
    focus: 'Repeated provider fields should become an authorable group shape.',
  },
  {
    filename: 'dd-form-293_2020.pdf',
    targetSet: 'next-risk',
    category: 'noisy-static-review-form',
    targetLevel: 'builder-native',
    focus: 'Static correction-board form should have semantic pages and fewer prose labels.',
  },
  {
    filename: 'va-form-95-tort-claim_2020.pdf',
    targetSet: 'next-risk',
    category: 'static-claim-form',
    targetLevel: 'structured',
    focus: 'Static tort-claim form should move out of generic page structure.',
  },
  {
    filename: 'va-form-21-8940-tdiu_app_2020.pdf',
    targetSet: 'next-risk',
    category: 'employment-history-static',
    targetLevel: 'structured',
    focus: 'TDIU static form should infer employment/claim sections without generic fallback pages.',
  },
  {
    filename: 'VBA-21P-527EZ-ARE.pdf',
    targetSet: 'next-risk',
    category: 'large-pension-xfa',
    targetLevel: 'builder-native',
    focus: 'Large pension XFA form should reduce duplicate labels and repeated groups into authorable structures.',
  },
  {
    filename: 'VBA-21P-534EZ-ARE.pdf',
    targetSet: 'next-risk',
    category: 'large-survivor-pension-xfa',
    targetLevel: 'builder-native',
    focus: 'Large survivor pension XFA form should reduce duplicate labels and repeated groups into authorable structures.',
  },
  {
    filename: 'VBA-21P-535-ARE.pdf',
    targetSet: 'next-risk',
    category: 'parent-dic-xfa',
    targetLevel: 'curated',
    focus: 'Parent DIC XFA packet should be fully curated across VA 21P-535 and attached SSA-24 pages.',
  },
  {
    filename: 'va-form-3288.pdf',
    targetSet: 'next-risk',
    category: 'records-release-acroform',
    targetLevel: 'curated',
    focus: 'AcroForm consent-to-release form should be fully curated into records-release sections, not a generic dump.',
  },
];

function parseArgs(args) {
  const positional = [];
  const flags = {
    out: 'build/import-corpus-report.json',
    markdown: null,
    limit: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out') {
      flags.out = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--out=')) {
      flags.out = arg.slice('--out='.length);
    } else if (arg === '--markdown') {
      flags.markdown = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--markdown=')) {
      flags.markdown = arg.slice('--markdown='.length);
    } else if (arg === '--limit') {
      flags.limit = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--limit=')) {
      flags.limit = Number(arg.slice('--limit='.length));
    } else if (arg.startsWith('--')) {
      stderr.write(`Unknown flag: ${arg}\n`);
      exit(2);
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function deriveFormId(filename) {
  return basename(filename, extname(filename))
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'imported-form';
}

function listPdfFiles(inputDir, limit) {
  const dir = resolve(inputDir);
  const files = readdirSync(dir)
    .filter(file => extname(file).toLowerCase() === '.pdf')
    .sort((a, b) => a.localeCompare(b))
    .map(file => resolve(dir, file));

  return Number.isFinite(limit) && limit > 0 ? files.slice(0, limit) : files;
}

function flattenComponents(form) {
  const components = [];
  for (const chapter of form.chapters || []) {
    for (const page of chapter.pages || []) {
      for (const component of page.components || []) {
        components.push({ chapter, page, component });
      }
    }
  }
  return components;
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    const key = value || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function repeatedLabels(components) {
  return Object.entries(countBy(components.map(({ component }) => component.label)))
    .filter(([, count]) => count > 1)
    .map(([label, count]) => ({ label, count }));
}

export function qualitySignals(form, importReport) {
  const components = flattenComponents(form);
  const lowConfidence = components.filter(
    ({ component }) => (component.provenance?.confidence ?? 0) < 0.5,
  );
  const veryLongLabels = components
    .filter(({ component }) => String(component.label || '').length > 90)
    .map(({ component }) => component.label);
  const genericPages = (form.chapters || []).flatMap(chapter =>
    (chapter.pages || [])
      .filter(page => /^page\s+\d+$/i.test(page.title || ''))
      .map(page => `${chapter.title} / ${page.title}`),
  );
  const genericChapters = (form.chapters || [])
    .filter(chapter => /^(imported form|needs review)$/i.test(chapter.title || ''))
    .map(chapter => chapter.title);
  const duplicateLabels = repeatedLabels(components);
  const curatedCount = components.filter(({ component }) => component.provenance?.curation).length;
  const curatedRatio = components.length
    ? Number((curatedCount / components.length).toFixed(3))
    : 0;
  const lowConfidenceRatio = components.length
    ? Number((lowConfidence.length / components.length).toFixed(3))
    : 0;
  const listLoopCount = (form.chapters || []).filter(chapter => chapter.type === 'listLoop').length;

  return {
    lowConfidenceCount: lowConfidence.length,
    lowConfidenceRatio,
    veryLongLabels: veryLongLabels.slice(0, 10),
    duplicateLabels: duplicateLabels.slice(0, 10),
    genericChapters,
    genericPages: genericPages.slice(0, 10),
    curatedCount,
    uncuratedCount: components.length - curatedCount,
    curatedRatio,
    listLoopCount,
    needsReview:
      !importReport.validation.valid ||
      components.length === 0 ||
      genericChapters.length > 0 ||
      genericPages.length > 0 ||
      veryLongLabels.length > 0 ||
      duplicateLabels.length > 0 ||
      curatedCount === 0 ||
      (lowConfidenceRatio > 0.65 && curatedRatio < 0.8 && listLoopCount === 0),
  };
}

function makeQuality(level, reasons) {
  return {
    level,
    rank: QUALITY_RANKS[level],
    reasons,
  };
}

export function assessImportQuality(result) {
  if (result.status !== 'ok') {
    return makeQuality('failed', ['Import failed.']);
  }

  const reasons = [];
  const signals = result.qualitySignals || {};
  const componentCount = result.componentCount || 0;
  const curatedRatio = signals.curatedRatio || 0;
  const lowConfidenceRatio = signals.lowConfidenceRatio || 0;
  const genericStructure =
    (signals.genericChapters || []).length > 0 || (signals.genericPages || []).length > 0;
  const labelIssues =
    (signals.veryLongLabels || []).length > 0 || (signals.duplicateLabels || []).length > 0;
  const hasListLoop = (signals.listLoopCount || 0) > 0;

  if (componentCount === 0) reasons.push('No form components were created.');
  if (!result.validation?.valid) reasons.push('Authoring validation did not pass.');
  if (componentCount === 0 || !result.validation?.valid) return makeQuality('raw', reasons);

  if (genericStructure) {
    reasons.push('Uses generic imported-form/page structure instead of semantic chapters/pages.');
    return makeQuality('valid', reasons);
  }

  if (labelIssues) {
    reasons.push('Has duplicate or overly long labels that need author cleanup.');
  }
  if (lowConfidenceRatio > 0.65 && curatedRatio < 0.8 && !hasListLoop) {
    reasons.push('Most components are low-confidence and not backed by curation.');
  }
  if (labelIssues || (lowConfidenceRatio > 0.65 && curatedRatio < 0.8 && !hasListLoop)) {
    return makeQuality('structured', reasons);
  }

  if (result.curation?.status === 'curated' && curatedRatio >= 0.8) {
    return makeQuality('curated', []);
  }

  reasons.push('Builder-shaped, but not yet backed by recipe or corpus curation.');
  return makeQuality('builder-native', reasons);
}

function summarizeImport(filePath, result, durationMs) {
  const { form, importReport } = result;
  const components = flattenComponents(form);
  const summary = {
    file: filePath,
    filename: basename(filePath),
    formId: form.formId,
    title: form.title,
    status: 'ok',
    durationMs,
    pageCount: importReport.pageCount,
    acroFormFieldCount: importReport.acroFormFieldCount,
    componentCount: importReport.componentCount,
    validation: importReport.validation,
    enrichment: importReport.enrichment,
    curation: importReport.curation,
    corpusHits: importReport.corpusHits,
    chapterCount: form.chapters?.length || 0,
    pageCountAuthored: (form.chapters || []).reduce(
      (count, chapter) => count + (chapter.pages || []).length,
      0,
    ),
    componentTypes: countBy(components.map(({ component }) => component.type)),
    provenanceOrigins: countBy(components.map(({ component }) => component.provenance?.origin)),
    chapters: (form.chapters || []).map(chapter => ({
      id: chapter.id,
      type: chapter.type || 'standard',
      title: chapter.title,
      pages: (chapter.pages || []).map(page => ({
        id: page.id,
        title: page.title,
        componentCount: (page.components || []).length,
      })),
    })),
    sampleLabels: components.slice(0, 20).map(({ component }) => ({
      id: component.id,
      type: component.type,
      label: component.label,
      confidence: component.provenance?.confidence ?? null,
    })),
    qualitySignals: qualitySignals(form, importReport),
  };
  summary.quality = assessImportQuality(summary);
  return summary;
}

async function importFile(filePath) {
  const startedAt = Date.now();
  const bytes = readFileSync(filePath);
  const result = await importPdf(bytes, {
    filename: basename(filePath),
    formId: deriveFormId(filePath),
    enrich: false,
  });
  return summarizeImport(filePath, result, Date.now() - startedAt);
}

function summarizeCorpus(results) {
  const successful = results.filter(result => result.status === 'ok');
  const failed = results.filter(result => result.status === 'error');
  const byExtractionKind = countBy(
    successful.map(result => (result.acroFormFieldCount > 0 ? 'acroform' : 'static')),
  );
  const byCurationStatus = countBy(successful.map(result => result.curation?.status));
  const totalComponents = successful.reduce((sum, result) => sum + result.componentCount, 0);
  const totalCurated = successful.reduce(
    (sum, result) => sum + result.qualitySignals.curatedCount,
    0,
  );
  const needsReview = successful.filter(result => result.qualitySignals.needsReview);
  const qualityLevels = countBy(results.map(result => result.quality?.level || result.status));
  const representativeTargets = representativeTargetStatus(results);

  return {
    totalFiles: results.length,
    successful: successful.length,
    failed: failed.length,
    totalComponents,
    totalCurated,
    curatedRatio: totalComponents ? Number((totalCurated / totalComponents).toFixed(3)) : 0,
    qualityLevels,
    byExtractionKind,
    byCurationStatus,
    needsReviewCount: needsReview.length,
    representativeTargets,
    representativeTargetsMet: representativeTargets.filter(target => target.meetsTarget).length,
    failures: failed.map(result => ({
      filename: result.filename,
      error: result.error,
    })),
    highestRisk: needsReview
      .map(result => ({
        filename: result.filename,
        componentCount: result.componentCount,
        qualityLevel: result.quality?.level,
        curationStatus: result.curation?.status,
        lowConfidenceRatio: result.qualitySignals.lowConfidenceRatio,
        genericChapters: result.qualitySignals.genericChapters,
        genericPages: result.qualitySignals.genericPages.length,
        duplicateLabels: result.qualitySignals.duplicateLabels.length,
        veryLongLabels: result.qualitySignals.veryLongLabels.length,
      }))
      .sort((a, b) => {
        if (a.curationStatus === 'generic-fallback' && b.curationStatus !== 'generic-fallback') return -1;
        if (b.curationStatus === 'generic-fallback' && a.curationStatus !== 'generic-fallback') return 1;
        return b.lowConfidenceRatio - a.lowConfidenceRatio;
      })
      .slice(0, 12),
  };
}

function representativeTargetStatus(results) {
  return REPRESENTATIVE_TARGETS.map(target => {
    const result = results.find(candidate => candidate.filename === target.filename);
    if (!result) {
      return {
        ...target,
        status: 'missing',
        currentLevel: 'missing',
        meetsTarget: false,
        gaps: ['Target PDF was not present in this corpus run.'],
      };
    }

    const currentLevel = result.quality?.level || (result.status === 'ok' ? 'raw' : 'failed');
    return {
      ...target,
      status: result.status,
      currentLevel,
      currentRank: result.quality?.rank ?? QUALITY_RANKS[currentLevel] ?? 0,
      targetRank: QUALITY_RANKS[target.targetLevel],
      meetsTarget: (result.quality?.rank ?? 0) >= QUALITY_RANKS[target.targetLevel],
      gaps: result.quality?.reasons?.slice(0, 4) || [],
    };
  });
}

function markdownReport(report) {
  const lines = [
    '# Import Corpus Report',
    '',
    `Source: \`${report.sourceDir}\``,
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Files: ${report.summary.totalFiles}`,
    `- Successful: ${report.summary.successful}`,
    `- Failed: ${report.summary.failed}`,
    `- Components: ${report.summary.totalComponents}`,
    `- Curated ratio: ${report.summary.curatedRatio}`,
    `- Quality levels: ${JSON.stringify(report.summary.qualityLevels)}`,
    `- Needs review: ${report.summary.needsReviewCount}`,
    `- Representative targets met: ${report.summary.representativeTargetsMet}/${report.summary.representativeTargets.length}`,
    `- Extraction kinds: ${JSON.stringify(report.summary.byExtractionKind)}`,
    `- Curation statuses: ${JSON.stringify(report.summary.byCurationStatus)}`,
    '',
    '## Representative Targets',
    '',
    '| File | Set | Category | Current | Target | Meets target | Gaps |',
    '|---|---|---|---|---|---|---|',
    ...report.summary.representativeTargets.map(target =>
      [
        `\`${target.filename}\``,
        target.targetSet || '',
        target.category,
        target.currentLevel,
        target.targetLevel,
        target.meetsTarget ? 'yes' : 'no',
        target.gaps.length > 0 ? target.gaps.join('; ') : '',
      ].join(' | '),
    ),
    '',
    '## Highest Risk',
    '',
    '| File | Components | Quality | Curation | Low confidence | Generic pages | Long labels | Duplicate labels |',
    '|---|---:|---|---|---:|---:|---:|---:|',
    ...report.summary.highestRisk.map(item =>
      [
        `\`${item.filename}\``,
        item.componentCount,
        item.qualityLevel,
        item.curationStatus,
        item.lowConfidenceRatio,
        item.genericPages,
        item.veryLongLabels,
        item.duplicateLabels,
      ].join(' | '),
    ),
    '',
    '## All Forms',
    '',
    '| File | Status | Quality | Pages | AcroForm fields | Components | Sections | Curation | Types |',
    '|---|---|---|---:|---:|---:|---:|---|---|',
    ...report.results.map(result =>
      [
        `\`${result.filename}\``,
        result.status,
        result.quality?.level ?? '',
        result.pageCount ?? '',
        result.acroFormFieldCount ?? '',
        result.componentCount ?? '',
        result.chapterCount ?? '',
        result.curation?.status ?? '',
        result.componentTypes ? Object.entries(result.componentTypes).map(([type, count]) => `${type}:${count}`).join(', ') : '',
      ].join(' | '),
    ),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const { positional, flags } = parseArgs(argv.slice(2));
  const sourceDir = positional[0] || '../form-samples';
  const files = listPdfFiles(sourceDir, flags.limit);
  if (files.length === 0) {
    stderr.write(`No PDF files found in ${resolve(sourceDir)}\n`);
    exit(1);
  }

  const results = [];
  for (const [index, filePath] of files.entries()) {
    const label = `${index + 1}/${files.length} ${basename(filePath)}`;
    stdout.write(`Importing ${label}\n`);
    try {
      results.push(await importFile(filePath));
    } catch (error) {
      results.push({
        file: filePath,
        filename: basename(filePath),
        status: 'error',
        error: error instanceof Error ? error.stack || error.message : String(error),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceDir: resolve(sourceDir),
    options: {
      enrich: false,
      limit: flags.limit,
    },
    summary: null,
    results,
  };
  report.summary = summarizeCorpus(results);

  const outPath = resolve(flags.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  stdout.write(`Wrote ${outPath}\n`);

  if (flags.markdown) {
    const markdownPath = resolve(flags.markdown);
    mkdirSync(dirname(markdownPath), { recursive: true });
    writeFileSync(markdownPath, markdownReport(report));
    stdout.write(`Wrote ${markdownPath}\n`);
  }

  stdout.write(
    `Summary: ${report.summary.successful}/${report.summary.totalFiles} ok, ` +
      `${report.summary.failed} failed, ${report.summary.totalComponents} components, ` +
      `${report.summary.needsReviewCount} need review.\n`,
  );
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main().catch(error => {
    stderr.write(`${error.stack || error.message}\n`);
    exit(1);
  });
}
