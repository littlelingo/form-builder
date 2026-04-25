import type { AuthoringComponent, AuthoringForm, AuthoringProvenance } from '../types';

function mapComponent(
  component: AuthoringComponent,
  componentId: string,
  patch: Partial<AuthoringProvenance>,
): AuthoringComponent {
  if (component.id === componentId && component.provenance) {
    return {
      ...component,
      provenance: {
        ...component.provenance,
        ...patch,
      },
    };
  }
  if (Array.isArray(component.children) && component.children.length > 0) {
    return {
      ...component,
      children: component.children.map(child => mapComponent(child, componentId, patch)),
    };
  }
  return component;
}

function patchComponentInForm(
  form: AuthoringForm,
  componentId: string,
  patch: Partial<AuthoringProvenance>,
): AuthoringForm {
  return {
    ...form,
    chapters: form.chapters.map(chapter => ({
      ...chapter,
      pages: chapter.pages.map(page => ({
        ...page,
        components: page.components.map(component =>
          mapComponent(component, componentId, patch),
        ),
      })),
    })),
  };
}

export function acceptComponent(
  form: AuthoringForm,
  componentId: string,
  reviewer = 'self',
): AuthoringForm {
  return patchComponentInForm(form, componentId, {
    reviewed: true,
    lastCorrectedBy: reviewer,
  });
}

export function rejectComponent(
  form: AuthoringForm,
  componentId: string,
  reviewer = 'self',
): AuthoringForm {
  return patchComponentInForm(form, componentId, {
    reviewed: false,
    lastCorrectedBy: reviewer,
  });
}

export function unreviewedComponentCount(form: AuthoringForm): number {
  let count = 0;
  for (const chapter of form.chapters) {
    for (const page of chapter.pages) {
      for (const component of page.components) {
        if (component.provenance && component.provenance.reviewed === false) {
          count += 1;
        }
        if (Array.isArray(component.children)) {
          for (const child of component.children) {
            if (child.provenance && child.provenance.reviewed === false) {
              count += 1;
            }
          }
        }
      }
    }
  }
  return count;
}

export function confidenceBand(confidence: number | undefined): 'high' | 'medium' | 'low' {
  if (typeof confidence !== 'number') return 'low';
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}
