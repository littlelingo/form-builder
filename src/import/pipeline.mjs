import { buildAuthoringForm } from './build.mjs';
import { extractAcroForm } from './extract/acroform.mjs';
import { extractText } from './extract/text.mjs';
import { pairLabelsToFields } from './extract/pair.mjs';
import { inferStaticTextFields } from './extract/staticText.mjs';
import { loadCorpus } from './corpus/store.mjs';
import { applyEnrichment, enrichFields } from './llm/enricher.mjs';
import { runMigrations } from '../schema/migrations/registry.mjs';
import { computeBytesHash } from '../schema/migrations/schemaHash.mjs';
import { validateAuthoringForm } from '../compiler/authoringCompiler.mjs';

function deriveFormId(filename, fallback) {
  if (!filename) return fallback || 'imported-form';
  const base = filename
    .replace(/^.*[\\/]/, '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback || 'imported-form';
}

function emitProgress(onProgress, event) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress(event);
  } catch {
    // Progress callbacks should never affect the import pipeline.
  }
}

function countComponents(components = []) {
  return components.reduce(
    (count, component) => count + 1 + countComponents(component.children || []),
    0,
  );
}

export async function importPdf(pdfBytes, options = {}) {
  const t0 = Date.now();
  const onProgress = options.onProgress;
  // Defensive copy: pdfjs-dist consumes the underlying ArrayBuffer.
  const sourceBytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const acroformInput = new Uint8Array(sourceBytes);
  const textInput = new Uint8Array(sourceBytes);
  emitProgress(onProgress, {
    stage: 'fingerprint',
    detail: 'Computing the source hash and preparing PDF bytes.',
    elapsedMs: 0,
    byteLength: sourceBytes.byteLength,
  });
  const pdfHash = await computeBytesHash(sourceBytes);

  const formId = options.formId || deriveFormId(options.filename, options.formId);

  emitProgress(onProgress, {
    stage: 'extract-acroform',
    detail: 'Reading AcroForm fields, widgets, pages, and field metadata.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
  });
  const acroForm = await extractAcroForm(acroformInput);
  emitProgress(onProgress, {
    stage: 'extract-acroform',
    detail: `Found ${acroForm.fieldCount} AcroForm field${acroForm.fieldCount === 1 ? '' : 's'} across ${acroForm.pageCount} page${acroForm.pageCount === 1 ? '' : 's'}.`,
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: acroForm.pageCount,
    fieldCount: acroForm.fieldCount,
  });

  emitProgress(onProgress, {
    stage: 'extract-text',
    detail: 'Reading nearby page text so fields can inherit human labels.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: acroForm.pageCount,
    fieldCount: acroForm.fieldCount,
  });
  const text = await extractText(textInput, {
    onProgress: event =>
      emitProgress(onProgress, {
        ...event,
        elapsedMs: Date.now() - t0,
        formId,
        pdfHash,
        fieldCount: acroForm.fieldCount,
      }),
  });

  emitProgress(onProgress, {
    stage: 'pair-labels',
    detail:
      acroForm.fieldCount > 0
        ? 'Pairing field boxes with nearest labels and adjacent text.'
        : 'No usable AcroForm fields found. Inferring draft fields from visible PDF text layout.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: text.pageCount,
    fieldCount: acroForm.fieldCount,
  });
  const paired =
    acroForm.fieldCount > 0
      ? pairLabelsToFields(acroForm, text)
      : inferStaticTextFields(text);

  emitProgress(onProgress, {
    stage: 'pair-labels',
    detail:
      acroForm.fieldCount > 0
        ? `Paired ${paired.fields.length} fillable PDF field${paired.fields.length === 1 ? '' : 's'} with nearby labels.`
        : `Inferred ${paired.fields.length} draft builder field${paired.fields.length === 1 ? '' : 's'} from static PDF text.`,
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: text.pageCount,
    fieldCount: acroForm.fieldCount,
    pairedFieldCount: paired.fields.length,
  });

  emitProgress(onProgress, {
    stage: 'corpus',
    detail: 'Loading the corrections corpus and matching known field patterns.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: text.pageCount,
    fieldCount: acroForm.fieldCount,
    pairedFieldCount: paired.fields.length,
  });
  const corpus = options.corpus || loadCorpus();

  // Step 7 — LLM enricher (optional). Falls back gracefully if unavailable.
  emitProgress(onProgress, {
    stage: 'enrichment',
    detail:
      options.enrich === false
        ? 'Browser import is using deterministic extraction only. LLM enrichment is deferred to the proxy path.'
        : 'Checking whether optional field-label enrichment is available.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: text.pageCount,
    fieldCount: acroForm.fieldCount,
    pairedFieldCount: paired.fields.length,
    corpusEntryCount: corpus.length,
  });
  const enrichmentResult = await enrichFields(paired.fields, {
    enabled: options.enrich !== false,
    providerName: options.llmProvider,
    model: options.llmModel,
    useCache: options.useCache,
    formId,
    title: options.title || formId,
    pdfHash,
  });
  const enrichedFields = enrichmentResult.enriched
    ? applyEnrichment(paired.fields, enrichmentResult.enriched)
    : paired.fields;

  emitProgress(onProgress, {
    stage: 'build-authoring',
    detail:
      enrichmentResult.reason === 'success' || enrichmentResult.reason === 'cache-hit'
        ? `Applied ${enrichmentResult.provider} enrichment and building authoring JSON.`
        : `Building authoring JSON from deterministic extraction. Enrichment: ${enrichmentResult.reason}.`,
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: text.pageCount,
    fieldCount: acroForm.fieldCount,
    pairedFieldCount: paired.fields.length,
    corpusEntryCount: corpus.length,
    enrichment: enrichmentResult.reason,
  });
  const authoring = buildAuthoringForm({
    formId,
    title: options.title || formId,
    pdfHash,
    pdfUri: options.pdfUri || (options.filename ? `examples/${formId}/source.pdf` : null),
    importedBy: options.importedBy || 'importer',
    fields: enrichedFields,
    corpus,
  });

  const migrated = await runMigrations(authoring);

  emitProgress(onProgress, {
    stage: 'validate',
    detail: 'Validating the migrated authoring JSON against the builder schema.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: text.pageCount,
    fieldCount: acroForm.fieldCount,
    pairedFieldCount: paired.fields.length,
    corpusEntryCount: corpus.length,
    enrichment: enrichmentResult.reason,
    chapterCount: migrated.chapters?.length || 0,
  });
  const validation = validateAuthoringForm(migrated);
  const componentCount = (migrated.chapters || []).reduce(
    (count, chapter) =>
      count + (chapter.pages || []).reduce(
        (pageCount, page) => pageCount + countComponents(page.components || []),
        0,
      ),
    0,
  );

  let corpusHits = 0;
  for (const chapter of migrated.chapters || []) {
    for (const page of chapter.pages || []) {
      for (const component of page.components || []) {
        if (component?.provenance?.exemplarId) corpusHits += 1;
      }
    }
  }

  emitProgress(onProgress, {
    stage: 'complete',
    detail: validation.valid
      ? 'Import complete. Loading the generated form into the canvas.'
      : 'Import complete, but schema validation found issues.',
    elapsedMs: Date.now() - t0,
    formId,
    pdfHash,
    pageCount: acroForm.pageCount,
    fieldCount: acroForm.fieldCount,
    pairedFieldCount: paired.fields.length,
    corpusEntryCount: corpus.length,
    corpusHits,
    enrichment: enrichmentResult.reason,
    chapterCount: migrated.chapters?.length || 0,
    componentCount,
    validation,
  });

  return {
    form: migrated,
    importReport: {
      pdfHash,
      pageCount: acroForm.pageCount,
      acroFormFieldCount: acroForm.fieldCount,
      componentCount,
      corpusEntryCount: corpus.length,
      corpusHits,
      enrichment: {
        provider: enrichmentResult.provider,
        reason: enrichmentResult.reason,
        cacheHit: enrichmentResult.cacheHit,
        tokenEstimate: enrichmentResult.tokenEstimate,
        error: enrichmentResult.error || null,
      },
      durationMs: Date.now() - t0,
      validation,
    },
  };
}

export { extractAcroForm, extractText, pairLabelsToFields };
