import { buildAuthoringForm } from './build.mjs';
import { extractAcroForm } from './extract/acroform.mjs';
import { extractText } from './extract/text.mjs';
import { pairLabelsToFields } from './extract/pair.mjs';
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

export async function importPdf(pdfBytes, options = {}) {
  const t0 = Date.now();
  // Defensive copy: pdfjs-dist consumes the underlying ArrayBuffer.
  const sourceBytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const acroformInput = new Uint8Array(sourceBytes);
  const textInput = new Uint8Array(sourceBytes);
  const pdfHash = await computeBytesHash(sourceBytes);

  const formId = options.formId || deriveFormId(options.filename, options.formId);

  const acroForm = await extractAcroForm(acroformInput);
  const text = await extractText(textInput);
  const paired = pairLabelsToFields(acroForm, text);

  const corpus = options.corpus || loadCorpus();

  // Step 7 — LLM enricher (optional). Falls back gracefully if unavailable.
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

  const validation = validateAuthoringForm(migrated);

  let corpusHits = 0;
  for (const chapter of migrated.chapters || []) {
    for (const page of chapter.pages || []) {
      for (const component of page.components || []) {
        if (component?.provenance?.exemplarId) corpusHits += 1;
      }
    }
  }

  return {
    form: migrated,
    importReport: {
      pdfHash,
      pageCount: acroForm.pageCount,
      acroFormFieldCount: acroForm.fieldCount,
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
