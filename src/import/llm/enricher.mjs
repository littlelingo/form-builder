import { cacheKey, cacheRead, cacheWrite } from './cache.mjs';
import { selectProvider } from './registry.mjs';

const TOKEN_INPUT_CAP = 30_000;
const TOKEN_OUTPUT_CAP = 8_000;
const BATCH_FIELD_LIMIT = 15;

function approximateTokens(text) {
  // Rough heuristic: 4 chars ~ 1 token.
  return Math.ceil((text || '').length / 4);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function buildPayload({ formId, title, ombNumber, fields }) {
  return {
    formMetadata: { title, formId, ombNumber: ombNumber || null },
    fields: fields.map((field, index) => ({
      fieldId: field.fieldId || `f${index}`,
      acroFormName: field.name || null,
      acroFormType: field.type || null,
      heuristicLabel: field.closestLabel || null,
      neighborText: field.neighborText || '',
      heuristicType: field.heuristicType || null,
      heuristicConfidence: field.heuristicConfidence || 0,
      maxLength: field.maxLength || null,
      acroFormOptions: field.options || [],
    })),
  };
}

export async function enrichFields(rawFields, options = {}) {
  const enabled = options.enabled !== false;
  const providerName =
    options.providerName || process.env.IMPORT_LLM_PROVIDER || 'ollama';
  const useCache = options.useCache !== false;
  const formId = options.formId || 'imported-form';
  const title = options.title || formId;
  const ombNumber = options.ombNumber || null;
  const pdfHash = options.pdfHash || null;

  const fieldsWithIds = rawFields.map((field, index) => ({
    ...field,
    fieldId: field.fieldId || `f${index}`,
  }));

  if (!enabled || rawFields.length === 0) {
    return {
      provider: 'disabled',
      cacheHit: false,
      tokenEstimate: 0,
      enriched: null,
      reason: enabled ? 'no-fields' : 'disabled',
    };
  }

  const { provider, available } = await selectProvider(providerName);

  if (!available) {
    return {
      provider: provider.name,
      cacheHit: false,
      tokenEstimate: 0,
      enriched: null,
      reason: 'provider-unavailable',
    };
  }

  const payload = buildPayload({ formId, title, ombNumber, fields: fieldsWithIds });
  const tokenEstimate = approximateTokens(JSON.stringify(payload));
  if (tokenEstimate > TOKEN_INPUT_CAP) {
    return {
      provider: provider.name,
      cacheHit: false,
      tokenEstimate,
      enriched: null,
      reason: 'token-cap-exceeded',
    };
  }

  let key = null;
  if (useCache && pdfHash) {
    key = await cacheKey({
      pdfHash,
      providerName: provider.name,
      modelId: options.model || provider.defaultModel,
    });
    const cached = await cacheRead(key);
    if (cached) {
      return {
        provider: provider.name,
        cacheHit: true,
        tokenEstimate,
        enriched: cached,
        reason: 'cache-hit',
      };
    }
  }

  // Batch fields into chunks so we stay inside per-call context windows.
  const batches = chunk(payload.fields, BATCH_FIELD_LIMIT);
  const collected = [];
  let lastError = null;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const batchPayload = { ...payload, fields: batch };
    try {
      // eslint-disable-next-line no-await-in-loop
      const batchResult = await provider.enrich(batchPayload, {
        model: options.model,
        maxOutputTokens: TOKEN_OUTPUT_CAP,
      });
      if (batchResult && Array.isArray(batchResult.fields)) {
        collected.push(...batchResult.fields);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Continue to next batch; provider error in one batch shouldn't blank the rest.
    }
  }

  if (collected.length === 0) {
    return {
      provider: provider.name,
      cacheHit: false,
      tokenEstimate,
      enriched: null,
      reason: lastError ? 'provider-error' : 'empty-output',
      error: lastError,
    };
  }

  const result = { fields: collected };

  if (key) {
    await cacheWrite(key, result);
  }

  return {
    provider: provider.name,
    cacheHit: false,
    tokenEstimate,
    enriched: result,
    reason: 'success',
  };
}

export function applyEnrichment(rawFields, enriched) {
  if (!enriched || !Array.isArray(enriched.fields)) return rawFields;
  const byId = new Map(enriched.fields.map(f => [f.fieldId, f]));
  return rawFields.map((field, index) => {
    const id = field.fieldId || `f${index}`;
    const overlay = byId.get(id);
    if (!overlay) return { ...field, fieldId: id };
    return {
      ...field,
      fieldId: id,
      enriched: overlay,
    };
  });
}
