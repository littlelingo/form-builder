import type { AuthoringProvenance } from '../types';
import { confidenceBand } from './reviewState.ts';

interface SignalEntry {
  id: string;
  value: number;
  threshold: number;
  summary: string;
}

export interface ConfidenceInsight {
  summary: string;
  reasons: string[];
  checks: string[];
}

function clamp01(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function originReason(provenance: AuthoringProvenance): SignalEntry | null {
  if (provenance.origin !== 'pdf-static-region') return null;
  return {
    id: 'origin',
    value: 0,
    threshold: 1,
    summary: 'It came from visible PDF text instead of a fillable field.',
  };
}

function signalEntries(provenance: AuthoringProvenance): SignalEntry[] {
  const signals = provenance.signals || {};
  const entries: SignalEntry[] = [];

  const acroformSignal = clamp01(signals.acroformSignal);
  if (acroformSignal !== null && acroformSignal < 0.55) {
    entries.push({
      id: 'acroformSignal',
      value: acroformSignal,
      threshold: 0.55,
      summary: 'The PDF field structure gave weak clues.',
    });
  }

  const labelDistance = clamp01(signals.labelDistance);
  if (labelDistance !== null && labelDistance < 0.7) {
    entries.push({
      id: 'labelDistance',
      value: labelDistance,
      threshold: 0.7,
      summary: 'Nearby PDF text was unclear.',
    });
  }

  const classificationCertainty = clamp01(signals.classificationCertainty);
  if (classificationCertainty !== null && classificationCertainty < 0.6) {
    entries.push({
      id: 'classificationCertainty',
      value: classificationCertainty,
      threshold: 0.6,
      summary: 'The field type may need checking.',
    });
  }

  const corpusSimilarity = clamp01(signals.corpusSimilarity);
  if (corpusSimilarity !== null && corpusSimilarity < 0.6) {
    entries.push({
      id: 'corpusSimilarity',
      value: corpusSimilarity,
      threshold: 0.6,
      summary: 'No close match from past imports was found.',
    });
  }

  const validationMatch = clamp01(signals.validationMatch);
  if (validationMatch !== null && validationMatch < 0.55) {
    entries.push({
      id: 'validationMatch',
      value: validationMatch,
      threshold: 0.55,
      summary: 'Required and format clues were limited.',
    });
  }

  return entries;
}

function topReasons(provenance: AuthoringProvenance): string[] {
  const candidates = signalEntries(provenance);
  const origin = originReason(provenance);
  if (origin) {
    candidates.push(origin);
  }

  candidates.sort((a, b) => (b.threshold - b.value) - (a.threshold - a.value));
  const reasons = [...new Map(candidates.map(item => [item.id, item.summary])).values()];

  if (reasons.length > 0) {
    return reasons.slice(0, 3);
  }

  if (confidenceBand(provenance.confidence) === 'low') {
    return ['There were limited clues in the PDF for this field.'];
  }

  return ['This field was imported automatically and should be confirmed.'];
}

function summaryFromReasons(reasons: string[]): string {
  if (reasons.length === 0) {
    return 'Review this field to confirm it matches the PDF.';
  }
  if (reasons.length === 1) {
    return `Review this field because ${lowerFirst(reasons[0]).replace(/\.$/, '')}.`;
  }
  return `Review this field because ${lowerFirst(reasons[0]).replace(/\.$/, '')} and ${lowerFirst(reasons[1]).replace(/\.$/, '')}.`;
}

function checksForReasons(reasonText: string[]): string[] {
  const checks = ['Check the label text.', 'Confirm the field type.', 'Review hint text and answer choices.'];

  if (reasonText.some(reason => reason.includes('Required and format'))) {
    checks[2] = 'Set required and format rules if needed.';
  }
  if (reasonText.some(reason => reason.includes('visible PDF text'))) {
    checks[0] = 'Confirm this should be a fillable field.';
  }

  return checks.slice(0, 3);
}

export function buildConfidenceInsight(
  provenance: AuthoringProvenance | undefined,
): ConfidenceInsight {
  if (!provenance) {
    return {
      summary: 'Review this field to confirm it matches the PDF.',
      reasons: [],
      checks: ['Check the label text.', 'Confirm the field type.'],
    };
  }

  const reasons = topReasons(provenance);
  return {
    summary: summaryFromReasons(reasons),
    reasons,
    checks: checksForReasons(reasons),
  };
}
