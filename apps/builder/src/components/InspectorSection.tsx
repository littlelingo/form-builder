import type { ReactNode } from 'react';

interface InspectorSectionProps {
  children: ReactNode;
  defaultOpen?: boolean;
  eyebrow?: string;
  title: string;
}

export function InspectorSection({
  children,
  defaultOpen = false,
  eyebrow,
  title,
}: InspectorSectionProps) {
  return (
    <details className="builder-inspector-section" open={defaultOpen}>
      <summary>
        <span>
          {eyebrow && <span className="builder-inspector-section__eyebrow">{eyebrow}</span>}
          <strong>{title}</strong>
        </span>
        <span aria-hidden="true">+</span>
      </summary>
      <div className="builder-inspector-section__body">{children}</div>
    </details>
  );
}
