import { useState } from 'react';

import type { AuthoringProvenance } from '../types';
import { buildConfidenceInsight } from '../lib/confidenceInsights';
import { confidenceBand } from '../lib/reviewState';

interface ConfidenceBadgeProps {
  provenance: AuthoringProvenance;
  componentId: string;
  componentLabel?: string;
  componentType?: string;
  onAccept?: (componentId: string) => void;
  onReject?: (componentId: string) => void;
  compact?: boolean;
}

function bandLabel(band: 'high' | 'medium' | 'low'): string {
  if (band === 'high') return 'High';
  if (band === 'medium') return 'Medium';
  return 'Low';
}

function sourceLabel(origin: AuthoringProvenance['origin']): string {
  if (origin === 'pdf-field') return 'Imported from a fillable PDF field';
  if (origin === 'pdf-static-region') return 'Imported from visible PDF text';
  if (origin === 'template') return 'Imported from a template';
  return 'Hand authored';
}

export function ConfidenceBadge({
  provenance,
  componentId,
  componentLabel,
  componentType,
  onAccept,
  onReject,
  compact = false,
}: ConfidenceBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!provenance) return null;
  if (provenance.origin === 'hand-authored' && provenance.reviewed !== false) {
    return null;
  }

  const confidence = typeof provenance.confidence === 'number' ? provenance.confidence : 0;
  const band = confidenceBand(confidence);
  const reviewed = provenance.reviewed === true;
  const percent = Math.round(confidence * 100);
  const insight = buildConfidenceInsight(provenance, {
    label: componentLabel,
    componentType,
  });

  const className = `confidence-badge confidence-badge--${band}${reviewed ? ' confidence-badge--reviewed' : ''}${compact ? ' confidence-badge--compact' : ''}`;
  const ariaLabel = reviewed
    ? `${bandLabel(band)} confidence ${percent}% (reviewed)`
    : `${bandLabel(band)} confidence ${percent}% (unreviewed)`;

  return (
    <span className={className}>
      <button
        type="button"
        className="confidence-badge__chip"
        aria-label={ariaLabel}
        onClick={event => {
          event.stopPropagation();
          setOpen(prev => !prev);
        }}
      >
        <span className="confidence-badge__dot" aria-hidden="true" />
        {compact ? `${percent}%` : `${bandLabel(band)} • ${percent}%`}
        {reviewed && <span className="confidence-badge__check">✓</span>}
      </button>
      {open && (
        <div className="confidence-badge__popover" role="dialog">
          <header>
            <strong>Confidence {percent}%</strong>
            <small>{sourceLabel(provenance.origin)}</small>
          </header>
          <p>
            <strong>Why review this?</strong> {insight.summary}
          </p>
          <ul className="confidence-badge__checks">
            {insight.checks.map(check => (
              <li key={check}>{check}</li>
            ))}
          </ul>
          {provenance.pdfFieldName && (
            <p>
              <strong>PDF field name:</strong> <code>{provenance.pdfFieldName}</code>
            </p>
          )}
          {typeof provenance.pdfPage === 'number' && (
            <p>
              <strong>Page:</strong> {provenance.pdfPage + 1}
            </p>
          )}
          {provenance.exemplarId && (
            <p>
              <strong>Exemplar match:</strong> <code>{provenance.exemplarId}</code>
            </p>
          )}
          <div className="confidence-badge__actions">
            {onAccept && (
              <button
                type="button"
                className="usa-button usa-button--small"
                onClick={event => {
                  event.stopPropagation();
                  onAccept(componentId);
                  setOpen(false);
                }}
              >
                Accept
              </button>
            )}
            {onReject && (
              <button
                type="button"
                className="usa-button usa-button--secondary usa-button--small"
                onClick={event => {
                  event.stopPropagation();
                  onReject(componentId);
                  setOpen(false);
                }}
              >
                Mark for review
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
