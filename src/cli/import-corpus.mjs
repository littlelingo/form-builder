#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
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
export const PATTERN_GATE_PROFILES = {
  legacy: {
    minPatternCoverage: 0.45,
    minPatternWorstDecile: null,
    minPatternFamilyStatic: null,
    minPatternFamilyAcroform: null,
  },
  'phase-a': {
    minPatternCoverage: 0.75,
    minPatternWorstDecile: 0.55,
    minPatternFamilyStatic: 0.7,
    minPatternFamilyAcroform: 0.75,
  },
  'phase-b': {
    minPatternCoverage: 0.8,
    minPatternWorstDecile: 0.65,
    minPatternFamilyStatic: 0.78,
    minPatternFamilyAcroform: 0.8,
  },
  'phase-c': {
    minPatternCoverage: 0.85,
    minPatternWorstDecile: 0.72,
    minPatternFamilyStatic: 0.83,
    minPatternFamilyAcroform: 0.85,
  },
  'phase-d': {
    minPatternCoverage: 0.9,
    minPatternWorstDecile: 0.82,
    minPatternFamilyStatic: 0.88,
    minPatternFamilyAcroform: 0.9,
  },
  'phase-e': {
    minPatternCoverage: 0.95,
    minPatternWorstDecile: 0.9,
    minPatternFamilyStatic: 0.93,
    minPatternFamilyAcroform: 0.95,
  },
  'phase-f': {
    minPatternCoverage: 0.97,
    minPatternWorstDecile: 0.94,
    minPatternFamilyStatic: 0.96,
    minPatternFamilyAcroform: 0.97,
  },
};
export const DEFAULT_PATTERN_GATE_PROFILE = 'phase-e';
export const DEFAULT_MIN_PATTERN_COVERAGE =
  PATTERN_GATE_PROFILES[DEFAULT_PATTERN_GATE_PROFILE].minPatternCoverage;
export const DEFAULT_CORPUS_MANIFEST = 'src/import/corpus/pools/expanded.json';

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
    targetLevel: 'curated',
    focus: 'Large pension XFA form should remain curated across Veteran, spouse, dependent, income, expense, direct-deposit, signature, and care-workflow sections.',
  },
  {
    filename: 'VBA-21P-534EZ-ARE.pdf',
    targetSet: 'next-risk',
    category: 'large-survivor-pension-xfa',
    targetLevel: 'curated',
    focus: 'Large survivor pension XFA form should remain curated across claimant, Veteran, service, marital, dependent, D.I.C., income, expense, direct-deposit, signature, and care-workflow sections.',
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
    manifest: null,
    recursive: false,
    strictManifest: false,
    gateProfile: DEFAULT_PATTERN_GATE_PROFILE,
    patternMode: 'hybrid',
    minPatternCoverage: null,
    minPatternWorstDecile: null,
    minPatternFamilyStatic: null,
    minPatternFamilyAcroform: null,
    patternGateEnabled: true,
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
    } else if (arg === '--manifest') {
      flags.manifest = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--manifest=')) {
      flags.manifest = arg.slice('--manifest='.length);
    } else if (arg === '--recursive') {
      flags.recursive = true;
    } else if (arg === '--strict-manifest') {
      flags.strictManifest = true;
    } else if (arg === '--gate-profile') {
      flags.gateProfile = String(args[i + 1] || DEFAULT_PATTERN_GATE_PROFILE).toLowerCase();
      i += 1;
    } else if (arg.startsWith('--gate-profile=')) {
      flags.gateProfile = String(arg.slice('--gate-profile='.length)).toLowerCase();
    } else if (arg === '--pattern-mode') {
      flags.patternMode = String(args[i + 1] || 'hybrid').toLowerCase();
      i += 1;
    } else if (arg.startsWith('--pattern-mode=')) {
      flags.patternMode = String(arg.slice('--pattern-mode='.length)).toLowerCase();
    } else if (arg === '--min-pattern-coverage') {
      flags.minPatternCoverage = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--min-pattern-coverage=')) {
      flags.minPatternCoverage = Number(arg.slice('--min-pattern-coverage='.length));
    } else if (arg === '--min-pattern-worst-decile') {
      flags.minPatternWorstDecile = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--min-pattern-worst-decile=')) {
      flags.minPatternWorstDecile = Number(arg.slice('--min-pattern-worst-decile='.length));
    } else if (arg === '--min-pattern-family-static') {
      flags.minPatternFamilyStatic = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--min-pattern-family-static=')) {
      flags.minPatternFamilyStatic = Number(arg.slice('--min-pattern-family-static='.length));
    } else if (arg === '--min-pattern-family-acroform') {
      flags.minPatternFamilyAcroform = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--min-pattern-family-acroform=')) {
      flags.minPatternFamilyAcroform = Number(arg.slice('--min-pattern-family-acroform='.length));
    } else if (arg === '--no-pattern-gate') {
      flags.patternGateEnabled = false;
    } else if (arg.startsWith('--')) {
      stderr.write(`Unknown flag: ${arg}\n`);
      exit(2);
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function valueOrProfile(value, profileValue) {
  return Number.isFinite(value) ? value : profileValue;
}

export function resolveGateConfig(options = {}) {
  const profileKey = options.gateProfile || DEFAULT_PATTERN_GATE_PROFILE;
  const profile = PATTERN_GATE_PROFILES[profileKey] || PATTERN_GATE_PROFILES[DEFAULT_PATTERN_GATE_PROFILE];
  const enabled = options.patternGateEnabled !== false;
  if (!enabled) {
    return {
      gateProfile: profileKey,
      minPatternCoverage: null,
      minPatternWorstDecile: null,
      minPatternFamilyStatic: null,
      minPatternFamilyAcroform: null,
    };
  }
  return {
    gateProfile: profileKey,
    minPatternCoverage: valueOrProfile(options.minPatternCoverage, profile.minPatternCoverage),
    minPatternWorstDecile: valueOrProfile(options.minPatternWorstDecile, profile.minPatternWorstDecile),
    minPatternFamilyStatic: valueOrProfile(options.minPatternFamilyStatic, profile.minPatternFamilyStatic),
    minPatternFamilyAcroform: valueOrProfile(options.minPatternFamilyAcroform, profile.minPatternFamilyAcroform),
  };
}

export function evaluateCorpusGates(summary, options = {}) {
  const checks = [];
  const config = resolveGateConfig(options);

  if (config.minPatternCoverage !== null) {
    checks.push({
      key: 'patternCoverage',
      label: 'Pattern coverage',
      actual: summary.patternCoverageRatio || 0,
      minimum: config.minPatternCoverage,
      passed: (summary.patternCoverageRatio || 0) >= config.minPatternCoverage,
    });
  }
  if (config.minPatternWorstDecile !== null) {
    checks.push({
      key: 'patternCoverageWorstDecile',
      label: 'Pattern coverage (worst decile)',
      actual: summary.worstDecilePatternCoverage || 0,
      minimum: config.minPatternWorstDecile,
      passed: (summary.worstDecilePatternCoverage || 0) >= config.minPatternWorstDecile,
    });
  }
  if (config.minPatternFamilyStatic !== null) {
    checks.push({
      key: 'patternCoverageStatic',
      label: 'Pattern coverage (static)',
      actual: summary.patternCoverageByExtractionKind?.static || 0,
      minimum: config.minPatternFamilyStatic,
      passed: (summary.patternCoverageByExtractionKind?.static || 0) >= config.minPatternFamilyStatic,
    });
  }
  if (config.minPatternFamilyAcroform !== null) {
    checks.push({
      key: 'patternCoverageAcroform',
      label: 'Pattern coverage (acroform/xfa)',
      actual: summary.patternCoverageByExtractionKind?.acroform || 0,
      minimum: config.minPatternFamilyAcroform,
      passed: (summary.patternCoverageByExtractionKind?.acroform || 0) >= config.minPatternFamilyAcroform,
    });
  }

  return {
    gateProfile: config.gateProfile,
    passed: checks.every(check => check.passed),
    checks,
  };
}

function deriveFormId(filename) {
  return basename(filename, extname(filename))
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'imported-form';
}

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTags(tags = []) {
  return [...new Set((Array.isArray(tags) ? tags : []).map(normalizeTag).filter(Boolean))].sort();
}

function walkPdfFiles(inputPath, options = {}) {
  const recursive = options.recursive === true;
  const root = resolve(inputPath);
  const queue = [root];
  const files = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const stat = statSync(current);
    if (stat.isFile()) {
      if (extname(current).toLowerCase() === '.pdf') files.push(current);
      continue;
    }
    const children = readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const childPath = resolve(current, child.name);
      if (child.isDirectory()) {
        if (recursive) queue.push(childPath);
        continue;
      }
      if (child.isFile() && extname(child.name).toLowerCase() === '.pdf') {
        files.push(childPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export function listPdfFiles(inputDir, limit, options = {}) {
  const files = walkPdfFiles(inputDir, options);
  return Number.isFinite(limit) && limit > 0 ? files.slice(0, limit) : files;
}

function normalizeManifestEntry(entry) {
  if (typeof entry === 'string') return { path: entry };
  return entry && typeof entry === 'object' ? entry : null;
}

export function resolveCorpusInput(options = {}) {
  const sourceDir = options.sourceDir || '../form-samples';
  const manifestPath = options.manifest ? resolve(options.manifest) : null;
  const limit = options.limit;
  const recursive = options.recursive === true;
  const strictManifest = options.strictManifest === true;

  if (!manifestPath) {
    const fileDescriptors = listPdfFiles(sourceDir, limit, { recursive }).map(filePath => ({
      filePath,
      tags: [],
      sources: [resolve(sourceDir)],
    }));
    return {
      source: {
        type: 'directory',
        path: resolve(sourceDir),
      },
      files: fileDescriptors,
      warnings: [],
    };
  }

  const manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = Array.isArray(manifestRaw)
    ? manifestRaw
    : Array.isArray(manifestRaw?.entries)
      ? manifestRaw.entries
      : [];
  if (entries.length === 0) {
    return {
      source: {
        type: 'manifest',
        path: manifestPath,
        name: manifestRaw?.name || null,
      },
      files: [],
      warnings: ['Manifest contains zero entries.'],
    };
  }

  const merged = new Map();
  const warnings = [];
  const manifestDir = dirname(manifestPath);
  for (const rawEntry of entries) {
    const entry = normalizeManifestEntry(rawEntry);
    if (!entry || !entry.path) {
      warnings.push('Skipped invalid manifest entry without a path.');
      continue;
    }
    const manifestRelativePath = resolve(manifestDir, entry.path);
    const cwdRelativePath = resolve(entry.path);
    const entryPath = existsSync(manifestRelativePath)
      ? manifestRelativePath
      : existsSync(cwdRelativePath)
        ? cwdRelativePath
        : manifestRelativePath;
    const required = entry.required === true;
    if (!existsSync(entryPath)) {
      if (required || strictManifest) {
        throw new Error(
          `Manifest entry path does not exist: ${entry.path} (checked ${manifestRelativePath} and ${cwdRelativePath})`,
        );
      }
      warnings.push(`Skipped missing manifest path: ${entry.path}`);
      continue;
    }

    const stat = statSync(entryPath);
    const entryRecursive = entry.recursive !== false;
    const tags = normalizeTags(entry.tags || []);
    const sources = [entry.path];
    const files = stat.isDirectory()
      ? walkPdfFiles(entryPath, { recursive: entryRecursive })
      : walkPdfFiles(entryPath, { recursive: false });

    for (const filePath of files) {
      const key = realpathSync(filePath);
      if (!merged.has(key)) {
        merged.set(key, {
          filePath: key,
          tags: [...tags],
          sources: [...sources],
        });
        continue;
      }
      const existing = merged.get(key);
      existing.tags = normalizeTags([...existing.tags, ...tags]);
      existing.sources = [...new Set([...existing.sources, ...sources])].sort();
      merged.set(key, existing);
    }
  }

  const files = [...merged.values()].sort((a, b) => a.filePath.localeCompare(b.filePath));
  const targetFileCount = Number.isFinite(manifestRaw?.targetFileCount)
    ? Number(manifestRaw.targetFileCount)
    : null;
  if (targetFileCount !== null && files.length < targetFileCount) {
    warnings.push(
      `Manifest targetFileCount=${targetFileCount} but only ${files.length} PDFs were resolved.`,
    );
  }
  return {
    source: {
      type: 'manifest',
      path: manifestPath,
      name: manifestRaw?.name || null,
      targetFileCount,
      entryCount: entries.length,
    },
    files: Number.isFinite(limit) && limit > 0 ? files.slice(0, limit) : files,
    warnings,
  };
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

function summarizeImport(filePath, result, durationMs, metadata = {}) {
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
    patterns: importReport.patterns,
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
    poolTags: normalizeTags(metadata.tags || []),
    poolSources: Array.isArray(metadata.sources) ? metadata.sources.slice().sort() : [],
    qualitySignals: qualitySignals(form, importReport),
  };
  summary.quality = assessImportQuality(summary);
  return summary;
}

async function importFile(descriptor, options = {}) {
  const filePath = descriptor.filePath;
  const startedAt = Date.now();
  const bytes = readFileSync(filePath);
  const result = await importPdf(bytes, {
    filename: basename(filePath),
    formId: deriveFormId(filePath),
    enrich: false,
    patternMode: options.patternMode === 'deterministic' ? 'deterministic' : 'hybrid',
  });
  return summarizeImport(filePath, result, Date.now() - startedAt, descriptor);
}

export function summarizeCorpus(results) {
  const successful = results.filter(result => result.status === 'ok');
  const failed = results.filter(result => result.status === 'error');
  const byExtractionKind = countBy(
    successful.map(result => (result.acroFormFieldCount > 0 ? 'acroform' : 'static')),
  );
  const byCurationStatus = countBy(successful.map(result => result.curation?.status));
  const byPoolTag = countBy(
    successful.flatMap(result =>
      (Array.isArray(result.poolTags) && result.poolTags.length > 0
        ? result.poolTags
        : ['untagged']),
    ),
  );
  const totalComponents = successful.reduce((sum, result) => sum + result.componentCount, 0);
  const totalCurated = successful.reduce(
    (sum, result) => sum + result.qualitySignals.curatedCount,
    0,
  );
  const totalPatternMatched = successful.reduce(
    (sum, result) => sum + (result.patterns?.matchedFieldCount || 0),
    0,
  );
  const totalPatternFields = successful.reduce(
    (sum, result) => sum + (result.patterns?.totalFieldCount || 0),
    0,
  );
  const patternSourceCounts = successful.reduce(
    (counts, result) => {
      const sources = result.patterns?.sourceCounts || {};
      for (const [source, value] of Object.entries(sources)) {
        counts[source] = (counts[source] || 0) + value;
      }
      return counts;
    },
    {},
  );
  const extractionPatternTotals = successful.reduce(
    (accumulator, result) => {
      const family = result.acroFormFieldCount > 0 ? 'acroform' : 'static';
      accumulator[family].matched += result.patterns?.matchedFieldCount || 0;
      accumulator[family].total += result.patterns?.totalFieldCount || 0;
      return accumulator;
    },
    {
      acroform: { matched: 0, total: 0 },
      static: { matched: 0, total: 0 },
    },
  );
  const patternCoverageByExtractionKind = {
    acroform:
      extractionPatternTotals.acroform.total > 0
        ? Number(
            (
              extractionPatternTotals.acroform.matched /
              extractionPatternTotals.acroform.total
            ).toFixed(3),
          )
        : 0,
    static:
      extractionPatternTotals.static.total > 0
        ? Number(
            (extractionPatternTotals.static.matched / extractionPatternTotals.static.total).toFixed(
              3,
            ),
          )
        : 0,
  };

  const patternCoverageCandidates = successful
    .map(result => ({
      filename: result.filename,
      coverageRatio: result.patterns?.coverageRatio || 0,
      matchedFieldCount: result.patterns?.matchedFieldCount || 0,
      totalFieldCount: result.patterns?.totalFieldCount || 0,
      extractionKind: result.acroFormFieldCount > 0 ? 'acroform' : 'static',
    }))
    .filter(entry => entry.totalFieldCount > 0);
  const sortedByPatternCoverage = patternCoverageCandidates
    .sort((a, b) => a.coverageRatio - b.coverageRatio);
  const worstDecileCount =
    sortedByPatternCoverage.length > 0
      ? Math.max(1, Math.ceil(sortedByPatternCoverage.length * 0.1))
      : 0;
  const worstDecile =
    worstDecileCount > 0 ? sortedByPatternCoverage.slice(0, worstDecileCount) : [];
  const worstDecilePatternCoverage =
    worstDecile.length > 0
      ? Number(
          (
            worstDecile.reduce((sum, entry) => sum + entry.coverageRatio, 0) / worstDecile.length
          ).toFixed(3),
        )
      : 0;

  const unmatchedTokenCounts = {};
  for (const result of successful) {
    const tokenRows = result.patterns?.unmatchedSummary?.topTokens || [];
    for (const tokenRow of tokenRows) {
      unmatchedTokenCounts[tokenRow.token] =
        (unmatchedTokenCounts[tokenRow.token] || 0) + tokenRow.count;
    }
  }
  const topUnmatchedTokens = Object.entries(unmatchedTokenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token, count]) => ({ token, count }));

  const needsReview = successful.filter(result => result.qualitySignals.needsReview);
  const qualityLevels = countBy(results.map(result => result.quality?.level || result.status));
  const representativeTargets = representativeTargetStatus(results);
  const lowestPatternCoverage = successful
    .map(result => ({
      filename: result.filename,
      matchedFieldCount: result.patterns?.matchedFieldCount || 0,
      totalFieldCount: result.patterns?.totalFieldCount || 0,
      coverageRatio: result.patterns?.coverageRatio || 0,
      curationStatus: result.curation?.status || null,
    }))
    .filter(item => item.totalFieldCount > 0)
    .sort((a, b) => a.coverageRatio - b.coverageRatio)
    .slice(0, 12);

  return {
    totalFiles: results.length,
    successful: successful.length,
    failed: failed.length,
    totalComponents,
    totalCurated,
    curatedRatio: totalComponents ? Number((totalCurated / totalComponents).toFixed(3)) : 0,
    totalPatternMatched,
    totalPatternFields,
    patternSourceCounts,
    patternCoverageRatio:
      totalPatternFields > 0 ? Number((totalPatternMatched / totalPatternFields).toFixed(3)) : 0,
    patternCoverageByExtractionKind,
    worstDecilePatternCoverage,
    worstDecile,
    topUnmatchedTokens,
    qualityLevels,
    byExtractionKind,
    byCurationStatus,
    byPoolTag,
    needsReviewCount: needsReview.length,
    representativeTargets,
    representativeTargetsMet: representativeTargets.filter(target => target.meetsTarget).length,
    lowestPatternCoverage,
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
  const gateSummary =
    report.gates?.checks?.length > 0
      ? report.gates.checks
          .map(check =>
            `${check.label}: ${check.passed ? 'pass' : 'fail'} (${check.actual} >= ${check.minimum})`,
          )
          .join('; ')
      : 'disabled';
  const lines = [
    '# Import Corpus Report',
    '',
    `Source: \`${report.sourceDir}\``,
    `Input mode: ${report.source?.type || 'directory'}${report.source?.name ? ` (${report.source.name})` : ''}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Files: ${report.summary.totalFiles}`,
    `- Successful: ${report.summary.successful}`,
    `- Failed: ${report.summary.failed}`,
    `- Components: ${report.summary.totalComponents}`,
    `- Curated ratio: ${report.summary.curatedRatio}`,
    `- Pattern coverage: ${report.summary.patternCoverageRatio} (${report.summary.totalPatternMatched}/${report.summary.totalPatternFields})`,
    `- Pattern sources: ${JSON.stringify(report.summary.patternSourceCounts)}`,
    `- Pattern coverage (static): ${report.summary.patternCoverageByExtractionKind?.static ?? 0}`,
    `- Pattern coverage (acroform/xfa): ${report.summary.patternCoverageByExtractionKind?.acroform ?? 0}`,
    `- Pattern coverage (worst decile): ${report.summary.worstDecilePatternCoverage ?? 0}`,
    `- Quality gates (${report.gates?.gateProfile || 'none'}): ${gateSummary}`,
    `- Quality levels: ${JSON.stringify(report.summary.qualityLevels)}`,
    `- Needs review: ${report.summary.needsReviewCount}`,
    `- Representative targets met: ${report.summary.representativeTargetsMet}/${report.summary.representativeTargets.length}`,
    `- Extraction kinds: ${JSON.stringify(report.summary.byExtractionKind)}`,
    `- Curation statuses: ${JSON.stringify(report.summary.byCurationStatus)}`,
    `- Pool tags: ${JSON.stringify(report.summary.byPoolTag)}`,
    '',
    '## Input Warnings',
    '',
    ...(report.warnings?.length
      ? report.warnings.map(item => `- ${item}`)
      : ['- none']),
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
    '## Worst Decile Coverage',
    '',
    '| File | Coverage | Matched | Total fields | Extraction |',
    '|---|---:|---:|---:|---|',
    ...report.summary.worstDecile.map(item =>
      [
        `\`${item.filename}\``,
        item.coverageRatio,
        item.matchedFieldCount,
        item.totalFieldCount,
        item.extractionKind,
      ].join(' | '),
    ),
    '',
    '## Top Unmatched Tokens',
    '',
    '| Token | Count |',
    '|---|---:|',
    ...report.summary.topUnmatchedTokens.map(item => [`\`${item.token}\``, item.count].join(' | ')),
    '',
    '## Lowest Pattern Coverage',
    '',
    '| File | Coverage | Matched | Total fields | Curation |',
    '|---|---:|---:|---:|---|',
    ...report.summary.lowestPatternCoverage.map(item =>
      [
        `\`${item.filename}\``,
        item.coverageRatio,
        item.matchedFieldCount,
        item.totalFieldCount,
        item.curationStatus,
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
    '| File | Status | Quality | Pages | AcroForm fields | Components | Sections | Curation | Tags | Types |',
    '|---|---|---|---:|---:|---:|---:|---|---|---|',
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
        (result.poolTags || []).join(', '),
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
  const resolvedInput = resolveCorpusInput({
    sourceDir,
    manifest: flags.manifest,
    limit: flags.limit,
    recursive: flags.recursive,
    strictManifest: flags.strictManifest,
  });
  const files = resolvedInput.files;
  if (files.length === 0) {
    if (resolvedInput.warnings.length > 0) {
      for (const warning of resolvedInput.warnings) {
        stderr.write(`Warning: ${warning}\n`);
      }
    }
    stderr.write(`No PDF files found for ${resolvedInput.source.path}\n`);
    exit(1);
  }
  if (resolvedInput.warnings.length > 0) {
    for (const warning of resolvedInput.warnings) {
      stderr.write(`Warning: ${warning}\n`);
    }
  }

  const results = [];
  for (const [index, descriptor] of files.entries()) {
    const filePath = descriptor.filePath;
    const label = `${index + 1}/${files.length} ${basename(filePath)}`;
    stdout.write(`Importing ${label}\n`);
    try {
      results.push(await importFile(descriptor, { patternMode: flags.patternMode }));
    } catch (error) {
      results.push({
        file: filePath,
        filename: basename(filePath),
        status: 'error',
        poolTags: normalizeTags(descriptor.tags || []),
        poolSources: Array.isArray(descriptor.sources) ? descriptor.sources.slice().sort() : [],
        error: error instanceof Error ? error.stack || error.message : String(error),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceDir: resolvedInput.source.path,
    source: resolvedInput.source,
    warnings: resolvedInput.warnings,
    options: {
      enrich: false,
      limit: flags.limit,
      manifest: flags.manifest ? resolve(flags.manifest) : null,
      recursive: flags.recursive,
      strictManifest: flags.strictManifest,
      patternMode: flags.patternMode,
      gateProfile: flags.gateProfile,
      patternGateEnabled: flags.patternGateEnabled,
      minPatternCoverage: flags.minPatternCoverage,
      minPatternWorstDecile: flags.minPatternWorstDecile,
      minPatternFamilyStatic: flags.minPatternFamilyStatic,
      minPatternFamilyAcroform: flags.minPatternFamilyAcroform,
    },
    summary: null,
    gates: null,
    results,
  };
  report.summary = summarizeCorpus(results);
  report.gates = evaluateCorpusGates(report.summary, {
    gateProfile: flags.gateProfile,
    patternGateEnabled: flags.patternGateEnabled,
    minPatternCoverage: flags.minPatternCoverage,
    minPatternWorstDecile: flags.minPatternWorstDecile,
    minPatternFamilyStatic: flags.minPatternFamilyStatic,
    minPatternFamilyAcroform: flags.minPatternFamilyAcroform,
  });

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
  if (!report.gates.passed) {
    const failures = report.gates.checks
      .filter(check => !check.passed)
      .map(check => `${check.label} ${check.actual} < ${check.minimum}`)
      .join('; ');
    stderr.write(`Quality gate failed (${report.gates.gateProfile}): ${failures}\n`);
    exit(1);
  }
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main().catch(error => {
    stderr.write(`${error.stack || error.message}\n`);
    exit(1);
  });
}
