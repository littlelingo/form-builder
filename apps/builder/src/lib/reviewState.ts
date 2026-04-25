import type { AuthoringComponent, AuthoringForm, AuthoringProvenance } from '../types';

function countComponents(
  components: AuthoringComponent[] = [],
  predicate: (component: AuthoringComponent) => boolean,
): number {
  let count = 0;
  for (const component of components) {
    if (predicate(component)) count += 1;
    if (Array.isArray(component.children)) {
      count += countComponents(component.children, predicate);
    }
  }
  return count;
}

function countFormComponents(
  form: AuthoringForm,
  predicate: (component: AuthoringComponent) => boolean,
): number {
  let count = 0;
  for (const chapter of form.chapters) {
    for (const page of chapter.pages) {
      count += countComponents(page.components, predicate);
    }
  }
  return count;
}

function isImportedComponent(component: AuthoringComponent): boolean {
  return (
    component.provenance?.origin === 'pdf-field' ||
    component.provenance?.origin === 'pdf-static-region'
  );
}

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
  return countFormComponents(form, component => component.provenance?.reviewed === false);
}

export function importedComponentCount(form: AuthoringForm): number {
  return countFormComponents(form, isImportedComponent);
}

export function confidenceBand(confidence: number | undefined): 'high' | 'medium' | 'low' {
  if (typeof confidence !== 'number') return 'low';
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}
