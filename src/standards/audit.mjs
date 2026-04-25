import { evaluatePredicate } from './predicate.mjs';

function eachComponentDeep(components = []) {
  const out = [];
  for (const component of components) {
    out.push(component);
    if (Array.isArray(component.children)) {
      out.push(...eachComponentDeep(component.children));
    }
  }
  return out;
}

function allComponentsWithLocation(form) {
  const out = [];
  (form.chapters || []).forEach((chapter, chapterIndex) => {
    (chapter.pages || []).forEach((page, pageIndex) => {
      eachComponentDeep(page.components || []).forEach(component => {
        out.push({
          component,
          chapterId: chapter.id,
          chapterIndex,
          pageId: page.id,
          pageIndex,
        });
      });
    });
  });
  return out;
}

function ruleViolation(rule, location) {
  return {
    ruleId: rule.id,
    severity: rule.severity || 'warning',
    scope: rule.scope,
    message: rule.message,
    fixHint: rule.fixHint,
    source: rule.source,
    componentId: location?.componentId || null,
    chapterId: location?.chapterId || null,
    pageId: location?.pageId || null,
  };
}

function evaluateRule(form, rule) {
  const violations = [];

  if (rule.scope === 'form') {
    if (!evaluatePredicate(rule.predicate, form)) {
      violations.push(ruleViolation(rule, null));
    }
    return violations;
  }

  if (rule.scope === 'chapter') {
    (form.chapters || []).forEach(chapter => {
      if (!evaluatePredicate(rule.predicate, chapter)) {
        violations.push(ruleViolation(rule, { chapterId: chapter.id }));
      }
    });
    return violations;
  }

  if (rule.scope === 'page') {
    (form.chapters || []).forEach(chapter => {
      (chapter.pages || []).forEach(page => {
        if (!evaluatePredicate(rule.predicate, page)) {
          violations.push(
            ruleViolation(rule, { chapterId: chapter.id, pageId: page.id }),
          );
        }
      });
    });
    return violations;
  }

  if (rule.scope === 'component') {
    allComponentsWithLocation(form).forEach(({ component, chapterId, pageId }) => {
      if (rule.appliesTo) {
        if (Array.isArray(rule.appliesTo) && !rule.appliesTo.includes(component.type)) {
          return;
        }
      }
      if (!evaluatePredicate(rule.predicate, component)) {
        violations.push(
          ruleViolation(rule, { componentId: component.id, chapterId, pageId }),
        );
      }
    });
    return violations;
  }

  return violations;
}

export function auditForm(form, rules = []) {
  const findings = rules.flatMap(rule => evaluateRule(form, rule));
  const blockers = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warning');
  const infos = findings.filter(f => f.severity === 'info');

  return {
    pass: blockers.length === 0,
    blockers,
    warnings,
    infos,
    findings,
  };
}
