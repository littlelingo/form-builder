const MONTH_ALIASES = new Map([
  ['JAN', 'JAN'],
  ['JANUARY', 'JAN'],
  ['FEB', 'FEB'],
  ['FEBRUARY', 'FEB'],
  ['MAR', 'MAR'],
  ['MARCH', 'MAR'],
  ['APR', 'APR'],
  ['APRIL', 'APR'],
  ['MAY', 'MAY'],
  ['JUN', 'JUN'],
  ['JUNE', 'JUN'],
  ['JUL', 'JUL'],
  ['JULY', 'JUL'],
  ['AUG', 'AUG'],
  ['AUGUST', 'AUG'],
  ['SEP', 'SEP'],
  ['SEPT', 'SEP'],
  ['SEPTEMBER', 'SEP'],
  ['OCT', 'OCT'],
  ['OCTOBER', 'OCT'],
  ['NOV', 'NOV'],
  ['NOVEMBER', 'NOV'],
  ['DEC', 'DEC'],
  ['DECEMBER', 'DEC'],
]);

const FORM_MARKER_REGEX =
  /\bVA\s*FORM\s*([0-9]{1,2}[A-Z]?\s*-?\s*[0-9]{2,5}[A-Z]{0,3})\b(?:\s*,\s*([A-Z]{3,9})\s+(\d{4}))?/gi;
const FORM_ONLY_REGEX = /^([0-9]{1,2}[A-Z]?\s*-?\s*[0-9]{2,5}[A-Z]{0,3})$/i;
const REVISION_REGEX =
  /\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T|TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(\d{4})\b/i;

function normalizeRevision(monthToken, yearToken) {
  if (!monthToken || !yearToken) return null;
  const month = MONTH_ALIASES.get(String(monthToken).toUpperCase()) || null;
  const year = Number.parseInt(String(yearToken), 10);
  if (!month || !Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return `${month} ${year}`;
}

export function canonicalizeFormNumber(raw) {
  if (!raw) return null;
  const compact = String(raw)
    .toUpperCase()
    .replace(/^VA\s*FORM/i, '')
    .replace(/[^0-9A-Z]+/g, '')
    .trim();
  const match = compact.match(/^([0-9]{1,2}[A-Z]?)([0-9]{2,5}[A-Z]{0,3})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

function inHeaderOrFooter(y) {
  if (typeof y !== 'number') return false;
  return y <= 0.14 || y >= 0.86;
}

function findLocalRevision(items, index) {
  const local = [
    items[index]?.text,
    items[index + 1]?.text,
    items[index + 2]?.text,
    items[index - 1]?.text,
  ]
    .filter(Boolean)
    .join(' ');
  const revision = local.match(REVISION_REGEX);
  return revision ? normalizeRevision(revision[1], revision[2]) : null;
}

function detectCandidatesOnPage(page, pageNumber) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const candidates = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const text = String(item?.text || '');
    const y = item?.bbox?.y;
    const marginSignal = inHeaderOrFooter(y);

    for (const match of text.matchAll(FORM_MARKER_REGEX)) {
      const formNumber = canonicalizeFormNumber(match[1]);
      if (!formNumber) continue;
      const revision = normalizeRevision(match[2], match[3]) || findLocalRevision(items, i);
      candidates.push({
        page: pageNumber,
        formNumber,
        revision,
        confidence: marginSignal ? 0.96 : 0.7,
        evidence: text,
      });
    }

    const looksLikeMarker = /\bVA\s*FORM\b/i.test(text);
    const nextText = String(items[i + 1]?.text || '').trim();
    if (looksLikeMarker && FORM_ONLY_REGEX.test(nextText)) {
      const formNumber = canonicalizeFormNumber(nextText);
      if (!formNumber) continue;
      const revision = findLocalRevision(items, i);
      const nextY = items[i + 1]?.bbox?.y;
      const marginPairSignal = inHeaderOrFooter(y) || inHeaderOrFooter(nextY);
      candidates.push({
        page: pageNumber,
        formNumber,
        revision,
        confidence: marginPairSignal ? 0.94 : 0.65,
        evidence: `${text} ${nextText}`.trim(),
      });
    }
  }

  return candidates;
}

function collapsePageDetections(candidates) {
  const byPage = new Map();
  for (const candidate of candidates) {
    const existing = byPage.get(candidate.page);
    if (!existing || candidate.confidence > existing.confidence) {
      byPage.set(candidate.page, candidate);
    }
  }
  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

function summarizeRanges(pages) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let prev = null;
  for (const page of sorted) {
    if (start === null) {
      start = page;
      prev = page;
      continue;
    }
    if (page === prev + 1) {
      prev = page;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = page;
    prev = page;
  }
  if (start !== null) {
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  }
  return ranges;
}

function summarizeDetectedForms(pageDetections) {
  const forms = new Map();
  for (const detection of pageDetections) {
    if (!forms.has(detection.formNumber)) {
      forms.set(detection.formNumber, {
        formNumber: detection.formNumber,
        revisions: new Set(),
        pages: [],
        evidence: [],
      });
    }
    const form = forms.get(detection.formNumber);
    if (detection.revision) form.revisions.add(detection.revision);
    form.pages.push(detection.page);
    if (detection.evidence) form.evidence.push(detection.evidence);
  }

  return [...forms.values()]
    .map(form => ({
      formNumber: form.formNumber,
      revisions: [...form.revisions].sort(),
      pages: [...new Set(form.pages)].sort((a, b) => a - b),
      pageRanges: summarizeRanges(form.pages),
      evidence: [...new Set(form.evidence)].slice(0, 3),
    }))
    .sort((a, b) => a.pages[0] - b.pages[0]);
}

function warningFromForms(forms) {
  if (forms.length < 2) return [];
  const details = forms
    .map(form => `${form.formNumber} (${form.pageRanges.join(', ')})`)
    .join('; ');
  return [`Detected multiple VA forms in one PDF: ${details}`];
}

export function detectFormInventory(text, metadata = {}) {
  const pages = Array.isArray(text?.pages) ? text.pages : [];
  const allCandidates = [];
  for (const page of pages) {
    const pageNumber = (page?.page ?? 0) + 1;
    allCandidates.push(...detectCandidatesOnPage(page, pageNumber));
  }

  const pageDetections = collapsePageDetections(allCandidates);
  const forms = summarizeDetectedForms(pageDetections);
  const warnings = warningFromForms(forms);
  const detectedFormCount = forms.length;
  const status =
    detectedFormCount === 0
      ? 'none-detected'
      : detectedFormCount > 1
        ? 'multi-form'
        : 'single-form';

  return {
    status,
    detectedFormCount,
    filename: metadata.filename || null,
    formId: metadata.formId || null,
    forms,
    pageDetections,
    warnings,
  };
}
