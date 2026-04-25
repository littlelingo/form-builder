// File-based deterministic cache for enricher output.
// Key = sha256({ pdfHash, promptVersion, providerName, modelId })
// Stored as JSON under .cache/import/<key>.json
// Skipped silently when fs unavailable (browser).

import { computeSchemaHash } from '../../schema/migrations/schemaHash.mjs';
import { ENRICHER_PROMPT_VERSION } from './provider.mjs';

let fsModulePromise = null;
async function loadFs() {
  if (fsModulePromise) return fsModulePromise;
  fsModulePromise = import('node:fs')
    .then(mod => ({
      readFileSync: mod.readFileSync,
      writeFileSync: mod.writeFileSync,
      existsSync: mod.existsSync,
      mkdirSync: mod.mkdirSync,
    }))
    .catch(() => null);
  return fsModulePromise;
}

const CACHE_DIR = '.cache/import';

export async function cacheKey({ pdfHash, providerName, modelId }) {
  const data = {
    pdfHash,
    promptVersion: ENRICHER_PROMPT_VERSION,
    providerName,
    modelId,
  };
  return computeSchemaHash(data);
}

export async function cacheRead(key) {
  const fs = await loadFs();
  if (!fs) return null;
  try {
    const path = `${CACHE_DIR}/${key.replace(/[^a-z0-9]/gi, '_')}.json`;
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export async function cacheWrite(key, value) {
  const fs = await loadFs();
  if (!fs) return;
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const path = `${CACHE_DIR}/${key.replace(/[^a-z0-9]/gi, '_')}.json`;
    fs.writeFileSync(path, JSON.stringify(value, null, 2));
  } catch {
    // Cache write best-effort.
  }
}
