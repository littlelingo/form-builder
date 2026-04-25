import { useMemo } from 'react';

import { auditFormAgainstDefaults } from '../lib/core';
import type { AuthoringForm, SelectedNode } from '../types';

interface StandardsAuditPanelProps {
  form: AuthoringForm;
  onJump?: (node: SelectedNode) => void;
}

interface Finding {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  scope: string;
  message: string;
  fixHint?: string;
  source: string;
  componentId: string | null;
  chapterId: string | null;
  pageId: string | null;
}

interface AuditResult {
  pass: boolean;
  blockers: Finding[];
  warnings: Finding[];
  infos: Finding[];
  findings: Finding[];
}

function locateComponent(
  form: AuthoringForm,
  componentId: string,
): { chapterId: string; pageId: string } | null {
  for (const chapter of form.chapters) {
    for (const page of chapter.pages) {
      const stack = [...page.components];
      while (stack.length) {
        const component = stack.shift();
        if (!component) continue;
        if (component.id === componentId) {
          return { chapterId: chapter.id, pageId: page.id };
        }
        if (Array.isArray(component.children)) stack.push(...component.children);
      }
    }
  }
  return null;
}

function groupBySource(findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = finding.source || 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(finding);
  }
  return map;
}

function severityLabel(severity: Finding['severity']): string {
  if (severity === 'error') return 'Blocker';
  if (severity === 'warning') return 'Warning';
  return 'Info';
}

export function StandardsAuditPanel({ form, onJump }: StandardsAuditPanelProps) {
  const result = useMemo<AuditResult>(() => {
    return auditFormAgainstDefaults(form) as AuditResult;
  }, [form]);

  const grouped = useMemo(() => groupBySource(result.findings), [result.findings]);

  const handleJump = (finding: Finding) => {
    if (!onJump) return;
    if (!finding.componentId) {
      // form/chapter/page-scoped: jump to first chapter/page of finding scope, or root
      const chapterId = finding.chapterId || form.chapters[0]?.id || '';
      const pageId =
        finding.pageId ||
        form.chapters.find(c => c.id === chapterId)?.pages[0]?.id ||
        '';
      if (chapterId && pageId) onJump({ chapterId, pageId });
      return;
    }
    const location = locateComponent(form, finding.componentId);
    if (location) {
      onJump({ ...location, componentId: finding.componentId });
    }
  };

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="standards-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Standards</p>
          <h2 id="standards-heading">
            VA.gov conformance{' '}
            <span className={`standards-status standards-status--${result.pass ? 'pass' : 'fail'}`}>
              {result.pass ? 'Pass' : `${result.blockers.length} blocker${result.blockers.length === 1 ? '' : 's'}`}
            </span>
          </h2>
        </div>
        <div className="standards-counts" aria-label="Finding counts">
          <span className="standards-count standards-count--error">{result.blockers.length} errors</span>
          <span className="standards-count standards-count--warning">{result.warnings.length} warnings</span>
          <span className="standards-count standards-count--info">{result.infos.length} infos</span>
        </div>
      </div>

      {result.findings.length === 0 ? (
        <p className="usa-prose">No standards findings. Form passes the built-in registry.</p>
      ) : (
        <div className="standards-groups">
          {Array.from(grouped.entries()).map(([source, findings]) => (
            <div key={source} className="standards-group">
              <h3 className="standards-group__heading">
                Source: <code>{source}</code>{' '}
                <small>({findings.length} finding{findings.length === 1 ? '' : 's'})</small>
              </h3>
              <ul className="standards-finding-list">
                {findings.map((finding, idx) => (
                  <li
                    key={`${finding.ruleId}-${idx}`}
                    className={`standards-finding standards-finding--${finding.severity}`}
                  >
                    <div className="standards-finding__header">
                      <span className="standards-finding__severity">{severityLabel(finding.severity)}</span>
                      <code className="standards-finding__id">{finding.ruleId}</code>
                    </div>
                    <p className="standards-finding__message">{finding.message}</p>
                    {finding.fixHint && (
                      <p className="standards-finding__fix">
                        <strong>Fix:</strong> {finding.fixHint}
                      </p>
                    )}
                    <div className="standards-finding__meta">
                      <span>Scope: {finding.scope}</span>
                      {finding.componentId && (
                        <span>
                          {' '}
                          • Component: <code>{finding.componentId}</code>
                        </span>
                      )}
                      {finding.chapterId && !finding.componentId && (
                        <span>
                          {' '}
                          • Chapter: <code>{finding.chapterId}</code>
                        </span>
                      )}
                      {finding.pageId && !finding.componentId && (
                        <span>
                          {' '}
                          • Page: <code>{finding.pageId}</code>
                        </span>
                      )}
                    </div>
                    {(finding.componentId || finding.chapterId) && onJump && (
                      <button
                        type="button"
                        className="usa-button usa-button--small usa-button--secondary"
                        onClick={() => handleJump(finding)}
                      >
                        Jump to {finding.componentId ? 'component' : finding.pageId ? 'page' : 'chapter'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
