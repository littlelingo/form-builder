function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const next = canonicalize(value[key]);
        if (next !== undefined) acc[key] = next;
        return acc;
      }, {});
  }
  return value;
}

function getSubtle() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto subtle.digest is unavailable. Requires Node 20+ or a modern browser.');
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function computeSchemaHash(form) {
  const { lineage, ...rest } = form || {};
  const stripped = lineage
    ? { ...rest, lineage: { ...lineage, schemaHash: undefined } }
    : rest;
  const cleaned = JSON.parse(JSON.stringify(stripped));
  const json = JSON.stringify(canonicalize(cleaned));
  const data = new TextEncoder().encode(json);
  const subtle = getSubtle();
  const buf = await subtle.digest('SHA-256', data);
  return `sha256:${bytesToHex(new Uint8Array(buf))}`;
}

export async function computeBytesHash(bytes) {
  const subtle = getSubtle();
  const buf = await subtle.digest('SHA-256', bytes);
  return `sha256:${bytesToHex(new Uint8Array(buf))}`;
}
