import type { AuthoringProvenance } from '../types';
import { confidenceBand } from './reviewState.ts';

interface SignalEntry {
  id: string;
  value: number;
  threshold: number;
  summary: string;
  check: string;
}

export interface ConfidenceInsight {
  summary: string;
  reasons: string[];
  checks: string[];
}

export interface ConfidenceInsightContext {
  label?: string;
  componentType?: string;
  hint?: string;
  responseOptionCount?: number;
  hasValidationRules?: boolean;
}

function clamp01(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function truncate(text: string, max = 44): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function typeHint(context?: ConfidenceInsightContext): string {
  if (!context?.componentType) return 'this field type';
  return `the "${context.componentType}" field type`;
}

function locationTag(provenance: AuthoringProvenance): string {
  const parts: string[] = [];
  if (provenance.pdfFieldName) {
    parts.push(`PDF field "${truncate(provenance.pdfFieldName)}"`);
  }
  if (typeof provenance.pdfPage === 'number') {
    parts.push(`page ${provenance.pdfPage + 1}`);
  }
  if (parts.length === 0) return '';
  return ` (${parts.join(', ')})`;
}

function originReason(provenance: AuthoringProvenance): SignalEntry | null {
  if (provenance.origin !== 'pdf-static-region') return null;
  return {
    id: 'origin',
    value: 0,
    threshold: 1,
    summary: 'It was created from visible PDF text instead of a fillable PDF field.',
    check: 'Confirm this is truly a fillable field and not instruction text.',
  };
}

function signalEntries(
  provenance: AuthoringProvenance,
  context?: ConfidenceInsightContext,
): SignalEntry[] {
  const signals = provenance.signals || {};
  const entries: SignalEntry[] = [];

  const acroformSignal = clamp01(signals.acroformSignal);
  if (acroformSignal !== null && acroformSignal < 0.55) {
    entries.push({
      id: 'acroformSignal',
      value: acroformSignal,
      threshold: 0.55,
      summary: `PDF field structure score is ${pct(acroformSignal)} (target ${pct(0.55)}), so field mapping may be off.`,
      check: 'Compare this field against the original PDF field name and placement.',
    });
  }

  const labelDistance = clamp01(signals.labelDistance);
  if (labelDistance !== null && labelDistance < 0.7) {
    entries.push({
      id: 'labelDistance',
      value: labelDistance,
      threshold: 0.7,
      summary: `Label match score is ${pct(labelDistance)} (target ${pct(0.7)}), so this may be tied to nearby text from another question.`,
      check: 'Confirm the label and nearby prompt text are pointing at the same question.',
    });
  }

  const classificationCertainty = clamp01(signals.classificationCertainty);
  if (classificationCertainty !== null && classificationCertainty < 0.6) {
    entries.push({
      id: 'classificationCertainty',
      value: classificationCertainty,
      threshold: 0.6,
      summary: `${typeHint(context)} certainty is ${pct(classificationCertainty)} (target ${pct(0.6)}), so the imported type may be wrong.`,
      check: 'Verify field type, answer behavior, and any choice list.',
    });
  }

  const corpusSimilarity = clamp01(signals.corpusSimilarity);
  if (corpusSimilarity !== null && corpusSimilarity < 0.6) {
    entries.push({
      id: 'corpusSimilarity',
      value: corpusSimilarity,
      threshold: 0.6,
      summary: `Pattern similarity is ${pct(corpusSimilarity)} (target ${pct(0.6)}), so there was no close match from prior imports.`,
      check: 'Check that section placement and grouping match nearby fields in the PDF.',
    });
  }

  const validationMatch = clamp01(signals.validationMatch);
  if (validationMatch !== null && validationMatch < 0.55) {
    entries.push({
      id: 'validationMatch',
      value: validationMatch,
      threshold: 0.55,
      summary: `Validation clue score is ${pct(validationMatch)} (target ${pct(0.55)}), so required or format rules may need manual setup.`,
      check: 'Confirm required, format, and validation hints from the source PDF.',
    });
  }

  return entries;
}

function contextEntries(
  provenance: AuthoringProvenance,
  context?: ConfidenceInsightContext,
): SignalEntry[] {
  const entries: SignalEntry[] = [];
  const fieldName = provenance.pdfFieldName || '';

  if (!fieldName && provenance.origin === 'pdf-static-region') {
    entries.push({
      id: 'noFieldName',
      value: 0.35,
      threshold: 0.9,
      summary: 'No fillable PDF field name was available, so this was inferred from nearby text only.',
      check: 'Check this field directly against the page text and question wording.',
    });
  }

  if (fieldName && /(?:^|[_-])(text|field|radio|check|group|item)\d*$/i.test(fieldName)) {
    entries.push({
      id: 'genericFieldName',
      value: 0.32,
      threshold: 0.85,
      summary: `PDF field name "${truncate(fieldName, 28)}" is generic, which makes label matching less reliable.`,
      check: `Verify this field is mapped to the right question for "${truncate(fieldName, 28)}".`,
    });
  }

  const hint = context?.hint?.trim() || '';
  if (hint) {
    const wordCount = hint.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 14) {
      entries.push({
        id: 'longHint',
        value: 0.4,
        threshold: 0.8,
        summary: `Nearby text is long (${wordCount} words), which can pull in instruction text instead of the exact prompt.`,
        check: `Confirm the field maps to the question near "${truncate(hint, 34)}".`,
      });
    }
  }

  if (context?.responseOptionCount && context.responseOptionCount > 0) {
    entries.push({
      id: 'optionsPresent',
      value: 0.45,
      threshold: 0.78,
      summary: `This field has ${context.responseOptionCount} choices, so option-to-question mapping should be verified.`,
      check: `Confirm all ${context.responseOptionCount} choices belong to this question and are in order.`,
    });
  }

  if (context?.hasValidationRules) {
    entries.push({
      id: 'hasValidationRules',
      value: 0.48,
      threshold: 0.76,
      summary: 'Validation rules are present, so required and format behavior should be double-checked.',
      check: 'Confirm imported validation messages and required behavior match the source.',
    });
  }

  return entries;
}

function topReasonEntries(
  provenance: AuthoringProvenance,
  context?: ConfidenceInsightContext,
): SignalEntry[] {
  const candidates = signalEntries(provenance, context);
  candidates.push(...contextEntries(provenance, context));
  const origin = originReason(provenance);
  if (origin) {
    candidates.push(origin);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => (b.threshold - b.value) - (a.threshold - a.value));
    return [...new Map(candidates.map(item => [item.id, item])).values()].slice(0, 3);
  }

  if (confidenceBand(provenance.confidence) === 'low') {
    return [
      {
        id: 'low-fallback',
        value: 0,
        threshold: 1,
        summary: `Low confidence score (${pct(clamp01(provenance.confidence) ?? 0)}) with limited import signals.`,
        check: 'Compare label, type, and hint text directly against the source PDF.',
      },
    ];
  }

  return [
    {
      id: 'default-fallback',
      value: 0,
      threshold: 1,
      summary: 'This field was imported automatically and should be confirmed.',
      check: 'Quickly confirm label and field type in the source PDF.',
    },
  ];
}

function summaryFromReasons(
  reasonEntries: SignalEntry[],
  provenance: AuthoringProvenance,
  context?: ConfidenceInsightContext,
): string {
  if (reasonEntries.length === 0) {
    return 'Review this field to confirm it matches the PDF.';
  }
  const target = context?.label ? `"${context.label}"` : 'this field';
  const reasons = reasonEntries.map(reason => reason.summary);
  const location = locationTag(provenance);
  if (reasons.length === 1) {
    return `Review ${target} because ${lowerFirst(reasons[0]).replace(/\.$/, '')}${location}.`;
  }
  return `Review ${target} because ${lowerFirst(reasons[0]).replace(/\.$/, '')} and ${lowerFirst(reasons[1]).replace(/\.$/, '')}${location}.`;
}

function checksForReasons(
  reasonEntries: SignalEntry[],
  provenance: AuthoringProvenance,
  context?: ConfidenceInsightContext,
): string[] {
  const checks: string[] = [];
  for (const reason of reasonEntries) {
    if (!checks.includes(reason.check)) checks.push(reason.check);
  }

  if (checks.length < 3 && provenance.pdfFieldName) {
    const pageSuffix = typeof provenance.pdfPage === 'number' ? ` on page ${provenance.pdfPage + 1}` : '';
    checks.push(`Cross-check against PDF field "${truncate(provenance.pdfFieldName, 34)}"${pageSuffix}.`);
  }

  if (checks.length < 3 && context?.hint) {
    checks.push(`Verify label and hint near "${truncate(context.hint, 34)}".`);
  }

  const choiceTypes = new Set(['radioButton', 'select', 'checkbox', 'comboBox']);
  if (checks.length < 3 && context?.componentType && choiceTypes.has(context.componentType)) {
    const optionCount =
      typeof context.responseOptionCount === 'number' && context.responseOptionCount > 0
        ? ` (${context.responseOptionCount} options)`
        : '';
    checks.push(`Confirm answer choices${optionCount} are complete and mapped to the right question.`);
  }

  if (checks.length < 3) {
    checks.push('Confirm the field type matches the expected answer format.');
  }

  if (checks.length < 3) {
    checks.push('Check nearby PDF text so label and hint stay aligned.');
  }

  return checks.slice(0, 3);
}

export function buildConfidenceInsight(
  provenance: AuthoringProvenance | undefined,
  context?: ConfidenceInsightContext,
): ConfidenceInsight {
  if (!provenance) {
    return {
      summary: 'Review this field to confirm it matches the PDF.',
      reasons: [],
      checks: ['Check the label text.', 'Confirm the field type.'],
    };
  }

  const reasonEntries = topReasonEntries(provenance, context);
  const reasons = reasonEntries.map(reason => reason.summary);
  return {
    summary: summaryFromReasons(reasonEntries, provenance, context),
    reasons,
    checks: checksForReasons(reasonEntries, provenance, context),
  };
}
