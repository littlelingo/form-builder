function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function tokenSet(...texts) {
  const set = new Set();
  for (const text of texts) {
    if (Array.isArray(text)) {
      for (const item of text) tokenize(item).forEach(t => set.add(t));
    } else {
      tokenize(text).forEach(t => set.add(t));
    }
  }
  return set;
}

export function jaccard(a, b) {
  if (!a || !b) return 0;
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function exemplarTokens(exemplar) {
  return tokenSet(
    exemplar.pdfFieldName,
    exemplar.labelAfter,
    exemplar.labelBefore,
    exemplar.neighborText,
  );
}

function fieldTokens(field) {
  // Use only label + field name. neighborText too noisy — picks up sibling-field
  // tokens that match other exemplars and biases classification.
  return tokenSet(field.name, field.closestLabel);
}

export function findNearestExemplar(field, corpus, options = {}) {
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.7;
  if (!Array.isArray(corpus) || corpus.length === 0) return null;

  const target = fieldTokens(field);
  if (target.size === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const exemplar of corpus) {
    const score = jaccard(target, exemplarTokens(exemplar));
    if (score > bestScore) {
      bestScore = score;
      best = exemplar;
    }
  }

  if (best && bestScore >= threshold) {
    return { exemplar: best, similarity: bestScore };
  }
  return null;
}
