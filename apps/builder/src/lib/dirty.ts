import type { AuthoringForm } from '../types';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const next = canonicalize((value as Record<string, unknown>)[key]);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return value;
}

export function signatureFromForm(form: AuthoringForm): string {
  const cleaned = JSON.parse(JSON.stringify(form));
  return JSON.stringify(canonicalize(cleaned));
}

export function isDirty(form: AuthoringForm, lastSavedSignature: string | null): boolean {
  if (!lastSavedSignature) return false;
  return signatureFromForm(form) !== lastSavedSignature;
}
