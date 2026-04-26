import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { importPdf } from '../import/pipeline.mjs';
import { createRecipeFromAuthoringForm } from '../import/curation/fromAuthoring.mjs';
import { validateRecipeCatalog } from '../import/curation/recipes.mjs';

function slug(value, fallback = 'form') {
  const text = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || fallback;
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const flags = {
    report: null,
    out: 'build/curation-learning-candidates.json',
    catalog: 'src/import/curation/catalog.json',
    appendCatalog: false,
    statuses: ['taxonomy-curated'],
    minComponents: 1,
    maxLowConfidenceRatio: 0.12,
    patternMode: 'deterministic',
    reviewedOnly: false,
    authoring: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report') {
      flags.report = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--report=')) {
      flags.report = arg.slice('--report='.length);
    } else if (arg === '--out') {
      flags.out = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--out=')) {
      flags.out = arg.slice('--out='.length);
    } else if (arg === '--catalog') {
      flags.catalog = argv[index + 1];
      index += 1;
    } else if (arg.startsWith('--catalog=')) {
      flags.catalog = arg.slice('--catalog='.length);
    } else if (arg === '--append-catalog') {
      flags.appendCatalog = true;
    } else if (arg === '--status') {
      flags.statuses = parseList(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--status=')) {
      flags.statuses = parseList(arg.slice('--status='.length));
    } else if (arg === '--min-components') {
      flags.minComponents = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--min-components=')) {
      flags.minComponents = Number(arg.slice('--min-components='.length));
    } else if (arg === '--max-low-confidence') {
      flags.maxLowConfidenceRatio = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--max-low-confidence=')) {
      flags.maxLowConfidenceRatio = Number(arg.slice('--max-low-confidence='.length));
    } else if (arg === '--pattern-mode') {
      flags.patternMode = String(argv[index + 1] || flags.patternMode).toLowerCase();
      index += 1;
    } else if (arg.startsWith('--pattern-mode=')) {
      flags.patternMode = String(arg.slice('--pattern-mode='.length)).toLowerCase();
    } else if (arg === '--reviewed-only') {
      flags.reviewedOnly = true;
    } else if (arg === '--include-unreviewed') {
      flags.reviewedOnly = false;
    } else if (arg === '--authoring') {
      flags.authoring.push(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--authoring=')) {
      flags.authoring.push(arg.slice('--authoring='.length));
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return flags;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function recipeId(form, seed) {
  const base = slug(form.formId || form.title || 'imported-form');
  const digest = createHash('sha1').update(String(seed || base)).digest('hex').slice(0, 10);
  return `auto-${base}-${digest}`;
}

function isLearnableResult(result, options) {
  if (!result || result.status !== 'ok') return false;
  const curationStatus = result.curation?.status || '';
  if (!options.statuses.includes(curationStatus)) return false;
  if ((result.componentCount || 0) < options.minComponents) return false;
  const lowConfidenceRatio = Number(result.qualitySignals?.lowConfidenceRatio || 0);
  if (lowConfidenceRatio > options.maxLowConfidenceRatio) return false;
  return true;
}

export function reportCandidates(report, options) {
  const results = Array.isArray(report?.results) ? report.results : [];
  return results.filter(result => isLearnableResult(result, options));
}

async function recipeFromImportedPdf(filePath, options) {
  const bytes = readFileSync(filePath);
  const filename = basename(filePath);
  const { form, importReport } = await importPdf(bytes, {
    filename,
    enrich: false,
    patternMode: options.patternMode === 'hybrid' ? 'hybrid' : 'deterministic',
  });
  const id = recipeId(form, `${filePath}:${importReport.pdfHash || ''}`);
  const recipe = createRecipeFromAuthoringForm(form, {
    id,
    title: `${form.title || form.formId || filename} auto-learned recipe`,
    description:
      'Auto-generated from imported components to reduce manual review for repeated form structures.',
    createdBy: 'curation-learn-cli',
    reviewedOnly: options.reviewedOnly,
  });
  return {
    recipe,
    source: {
      type: 'pdf',
      file: filePath,
      formId: form.formId,
      curationStatus: importReport.curation?.status || null,
      componentCount: importReport.componentCount || 0,
      lowConfidenceRatio: null,
    },
  };
}

function recipeFromAuthoringJson(path, options) {
  const form = readJson(path);
  const id = recipeId(form, `${path}:${form.formId || ''}:${form.title || ''}`);
  const recipe = createRecipeFromAuthoringForm(form, {
    id,
    title: `${form.title || form.formId || basename(path)} auto-learned recipe`,
    description:
      'Auto-generated from imported components to reduce manual review for repeated form structures.',
    createdBy: 'curation-learn-cli',
    reviewedOnly: options.reviewedOnly,
  });
  return {
    recipe,
    source: {
      type: 'authoring',
      file: path,
      formId: form.formId || null,
      componentCount: null,
    },
  };
}

function mergeCatalog(existingCatalog, newRecipes) {
  const existing = Array.isArray(existingCatalog?.recipes) ? existingCatalog.recipes : [];
  const existingIds = new Set(existing.map(recipe => recipe.id));
  const merged = [...existing];
  let appended = 0;
  for (const recipe of newRecipes) {
    if (existingIds.has(recipe.id)) continue;
    existingIds.add(recipe.id);
    merged.push(recipe);
    appended += 1;
  }
  return {
    appended,
    catalog: {
      version: existingCatalog?.version || '2026.04',
      generatedAt: existingCatalog?.generatedAt || new Date().toISOString(),
      recipes: merged,
    },
  };
}

export async function runCurationLearn(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  const recipesWithSource = [];

  if (flags.report) {
    const reportPath = resolve(flags.report);
    const report = readJson(reportPath);
    const selected = reportCandidates(report, {
      statuses: flags.statuses,
      minComponents: flags.minComponents,
      maxLowConfidenceRatio: flags.maxLowConfidenceRatio,
    });
    for (const item of selected) {
      if (!item.file) continue;
      const learned = await recipeFromImportedPdf(item.file, flags);
      recipesWithSource.push(learned);
    }
  }

  for (const authoringPath of flags.authoring) {
    const learned = recipeFromAuthoringJson(resolve(authoringPath), flags);
    recipesWithSource.push(learned);
  }

  const dedupedById = new Map();
  for (const entry of recipesWithSource) {
    if (!dedupedById.has(entry.recipe.id)) {
      dedupedById.set(entry.recipe.id, entry);
    }
  }
  const uniqueEntries = [...dedupedById.values()];
  const catalog = {
    version: '2026.04',
    generatedAt: new Date().toISOString(),
    recipes: uniqueEntries.map(entry => entry.recipe),
  };
  const validation = validateRecipeCatalog(catalog);
  if (!validation.valid) {
    throw new Error(`Generated catalog failed validation:\n${validation.errors.join('\n')}`);
  }

  const outPath = resolve(flags.out);
  writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  let appendSummary = null;
  if (flags.appendCatalog) {
    const catalogPath = resolve(flags.catalog);
    const existingCatalog = readJson(catalogPath);
    const merged = mergeCatalog(existingCatalog, catalog.recipes);
    const mergedValidation = validateRecipeCatalog(merged.catalog);
    if (!mergedValidation.valid) {
      throw new Error(`Merged catalog failed validation:\n${mergedValidation.errors.join('\n')}`);
    }
    writeFileSync(catalogPath, `${JSON.stringify(merged.catalog, null, 2)}\n`, 'utf8');
    appendSummary = {
      catalogPath,
      appended: merged.appended,
      totalRecipes: merged.catalog.recipes.length,
    };
  }

  return {
    outPath,
    generatedRecipeCount: catalog.recipes.length,
    sources: uniqueEntries.map(entry => entry.source),
    appendSummary,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCurationLearn()
    .then(summary => {
      process.stdout.write(
        `Wrote ${summary.outPath}\nGenerated ${summary.generatedRecipeCount} candidate recipe${summary.generatedRecipeCount === 1 ? '' : 's'}.\n`,
      );
      if (summary.appendSummary) {
        process.stdout.write(
          `Appended ${summary.appendSummary.appended} recipe${summary.appendSummary.appended === 1 ? '' : 's'} to ${summary.appendSummary.catalogPath} (total ${summary.appendSummary.totalRecipes}).\n`,
        );
      }
    })
    .catch(error => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
