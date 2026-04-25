import correctionsSeed from './corrections.json' with { type: 'json' };

let runtimeAppends = [];

export function loadCorpus() {
  return [...(correctionsSeed.entries || []), ...runtimeAppends];
}

export function loadCorpusVersion() {
  return correctionsSeed.version || '0.0.0';
}

export function appendCorpusEntry(entry) {
  if (!entry || typeof entry !== 'object') return;
  runtimeAppends = [...runtimeAppends, entry];
}

export function appendCorpusEntries(entries) {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) appendCorpusEntry(entry);
}

export function exportCorpus() {
  return {
    version: correctionsSeed.version || '0.0.0',
    exportedAt: new Date().toISOString(),
    entries: loadCorpus(),
  };
}

export function clearRuntimeAppends() {
  runtimeAppends = [];
}

export function runtimeAppendCount() {
  return runtimeAppends.length;
}
