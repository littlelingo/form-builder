import { compileComponent } from './componentRegistry.mjs';
import { validateComputedValue } from './computedValues.mjs';
import { validateRule } from './rules.mjs';
import { mergeSets, toIdentifier, toKebab, unique } from './utils.mjs';
import {
  getUnsupportedComponentTypes,
  hasComponentSystem,
} from '../component-systems/componentSystems.mjs';

const VALID_CHAPTER_TYPES = new Set(['standard', 'listLoop']);
const VALID_EVENT_NAMES = new Set([
  'field.change',
  'field.focus',
  'field.blur',
  'page.enter',
  'form.submit',
  'form.beforeSubmit',
]);
const VALID_ACTION_TYPES = new Set([
  'setValue',
  'setComponentProperty',
  'setVisibility',
  'setRequired',
  'setValidationMessage',
  'emitEvent',
]);
const DEFAULT_COMPONENT_SYSTEMS = {
  primary: 'uswds',
  generated: 'vaFormsSystem',
  preview: 'uswds',
  additional: ['shadcn'],
};

function normalizeComponentSystems(form) {
  return {
    ...DEFAULT_COMPONENT_SYSTEMS,
    ...(form.componentSystems || {}),
    additional: form.componentSystems?.additional || DEFAULT_COMPONENT_SYSTEMS.additional,
  };
}

function configuredComponentSystemIds(form) {
  const systems = normalizeComponentSystems(form);
  return unique([
    systems.primary,
    systems.generated,
    systems.preview,
    ...(systems.additional || []),
  ].filter(Boolean));
}

function collectRuleErrorsFromComponent(component, path) {
  return [
    ...(component.showIf ? validateRule(component.showIf, `${path}.showIf`) : []),
    ...(component.hideIf ? validateRule(component.hideIf, `${path}.hideIf`) : []),
    ...(component.requiredIf
      ? validateRule(component.requiredIf, `${path}.requiredIf`)
      : []),
    ...(component.validations || []).flatMap((validation, index) => [
      ...(!validation.message ? [`${path}.validations[${index}].message is required`] : []),
      ...(validation.rule
        ? validateRule(validation.rule, `${path}.validations[${index}].rule`)
        : [`${path}.validations[${index}].rule is required`]),
    ]),
  ];
}

function validatePrefillMappings(prefill, path = 'prefill') {
  if (!prefill?.mappings) return [];
  if (!Array.isArray(prefill.mappings)) {
    return [`${path}.mappings must be an array`];
  }

  return prefill.mappings.flatMap((mapping, index) => {
    const mappingPath = `${path}.mappings[${index}]`;
    const errors = [];

    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      return [`${mappingPath} must be an object`];
    }
    if (!mapping.source) errors.push(`${mappingPath}.source is required`);
    if (!mapping.target) errors.push(`${mappingPath}.target is required`);

    return errors;
  });
}

function nestedComponents(component) {
  return component.type === 'sectionGroup' ? component.children || [] : [];
}

function flattenComponents(components = []) {
  return components.flatMap(component => [component, ...flattenComponents(nestedComponents(component))]);
}

function componentMetadata(component) {
  const {
    children,
    showIf,
    hideIf,
    requiredIf,
    validations,
    events,
    ...metadata
  } = component;

  return metadata;
}

function validateEventActions(actions, path, ids) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [`${path}.actions must be a non-empty array`];
  }

  return actions.flatMap((action, index) => {
    const actionPath = `${path}.actions[${index}]`;
    const errors = [];

    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      return [`${actionPath} must be an object`];
    }
    if (!action.type) errors.push(`${actionPath}.type is required`);
    if (action.type && !VALID_ACTION_TYPES.has(action.type)) {
      errors.push(`${actionPath}.type "${action.type}" is not supported`);
    }

    if (action.condition) {
      errors.push(...validateRule(action.condition, `${actionPath}.condition`));
    }

    if (action.type === 'setValue' && !action.target) {
      errors.push(`${actionPath}.target is required for setValue`);
    }

    if (
      ['setComponentProperty', 'setVisibility', 'setRequired', 'setValidationMessage'].includes(
        action.type,
      )
    ) {
      if (!action.componentId) errors.push(`${actionPath}.componentId is required for ${action.type}`);
      if (action.componentId && !ids.fields.has(action.componentId)) {
        errors.push(`${actionPath}.componentId "${action.componentId}" does not match a component`);
      }
    }

    if (action.type === 'setComponentProperty' && !action.property) {
      errors.push(`${actionPath}.property is required for setComponentProperty`);
    }
    if (action.type === 'setValidationMessage' && !action.message) {
      errors.push(`${actionPath}.message is required for setValidationMessage`);
    }
    if (action.type === 'emitEvent' && !action.event) {
      errors.push(`${actionPath}.event is required for emitEvent`);
    }

    return errors;
  });
}

function validateEventHandlers(handlers, path, ids, scopedComponentId) {
  if (!handlers) return [];
  if (!Array.isArray(handlers)) return [`${path} must be an array`];

  return handlers.flatMap((handler, index) => {
    const handlerPath = `${path}[${index}]`;
    const errors = [];

    if (!handler || typeof handler !== 'object' || Array.isArray(handler)) {
      return [`${handlerPath} must be an object`];
    }
    if (!handler.id) errors.push(`${handlerPath}.id is required`);
    if (!handler.event) errors.push(`${handlerPath}.event is required`);
    if (handler.event && !VALID_EVENT_NAMES.has(handler.event)) {
      errors.push(`${handlerPath}.event "${handler.event}" is not supported`);
    }

    const componentId = handler.componentId || scopedComponentId;
    if (componentId && !ids.fields.has(componentId)) {
      errors.push(`${handlerPath}.componentId "${componentId}" does not match a component`);
    }

    if (handler.condition) {
      errors.push(...validateRule(handler.condition, `${handlerPath}.condition`));
    }
    errors.push(...validateEventActions(handler.actions, handlerPath, ids));

    return errors;
  });
}

export function validateAuthoringForm(form) {
  const errors = [];
  const warnings = [];
  const ids = {
    chapters: new Set(),
    pages: new Set(),
    fields: new Set(),
  };

  if (!form || typeof form !== 'object') {
    return { valid: false, errors: ['Form definition must be an object'], warnings };
  }

  ['schemaVersion', 'formId', 'title', 'chapters'].forEach(property => {
    if (form[property] === undefined) errors.push(`${property} is required`);
  });

  if (!Array.isArray(form.chapters) || form.chapters.length === 0) {
    errors.push('chapters must be a non-empty array');
  }

  configuredComponentSystemIds(form).forEach(systemId => {
    if (!hasComponentSystem(systemId)) {
      errors.push(`componentSystems contains unsupported target "${systemId}"`);
    }
  });

  (form.chapters || []).forEach((chapter, chapterIndex) => {
    const chapterPath = `chapters[${chapterIndex}]`;
    if (!chapter.id) errors.push(`${chapterPath}.id is required`);
    if (ids.chapters.has(chapter.id)) errors.push(`Duplicate chapter id "${chapter.id}"`);
    ids.chapters.add(chapter.id);

    const chapterType = chapter.type || 'standard';
    if (!VALID_CHAPTER_TYPES.has(chapterType)) {
      errors.push(`${chapterPath}.type "${chapterType}" is not supported`);
    }

    if (chapter.condition) {
      errors.push(...validateRule(chapter.condition, `${chapterPath}.condition`));
    }

    if (chapterType === 'listLoop') {
      if (!chapter.options?.nounSingular) {
        errors.push(`${chapterPath}.options.nounSingular is required for listLoop`);
      }
      if (!chapter.options?.nounPlural) {
        errors.push(`${chapterPath}.options.nounPlural is required for listLoop`);
      }
      if (!chapter.options || chapter.options.required === undefined) {
        errors.push(`${chapterPath}.options.required is required for listLoop`);
      }
      if (!chapter.itemNameLabel) {
        warnings.push({
          code: 'LIST_LOOP_ITEM_NAME_DEFAULT',
          message: `${chapterPath}.itemNameLabel is missing; compiler will use noun singular`,
        });
      }
    }

    if (!Array.isArray(chapter.pages) || chapter.pages.length === 0) {
      errors.push(`${chapterPath}.pages must be a non-empty array`);
    }

    (chapter.pages || []).forEach((page, pageIndex) => {
      const pagePath = `${chapterPath}.pages[${pageIndex}]`;
      if (!page.id) errors.push(`${pagePath}.id is required`);
      if (ids.pages.has(page.id)) errors.push(`Duplicate page id "${page.id}"`);
      ids.pages.add(page.id);

      if (page.condition) {
        errors.push(...validateRule(page.condition, `${pagePath}.condition`));
      }

      if (!Array.isArray(page.components)) {
        errors.push(`${pagePath}.components must be an array`);
      }

      flattenComponents(page.components || []).forEach((component, componentIndex) => {
        const componentPath = `${pagePath}.components[${componentIndex}]`;
        if (!component.id) errors.push(`${componentPath}.id is required`);
        if (ids.fields.has(component.id)) {
          errors.push(`Duplicate field/component id "${component.id}"`);
        }
        ids.fields.add(component.id);
      });
    });
  });

  (form.computedValues || []).forEach((computedValue, index) => {
    errors.push(
      ...validateComputedValue(computedValue, `computedValues[${index}]`),
    );
  });
  errors.push(...validatePrefillMappings(form.prefill));

  (form.chapters || []).forEach((chapter, chapterIndex) => {
    (chapter.pages || []).forEach((page, pageIndex) => {
      const pagePath = `chapters[${chapterIndex}].pages[${pageIndex}]`;
      flattenComponents(page.components || []).forEach((component, componentIndex) => {
        const componentPath = `${pagePath}.components[${componentIndex}]`;
        if (!component.type) errors.push(`${componentPath}.type is required`);
        if (!component.label) errors.push(`${componentPath}.label is required`);
        errors.push(...collectRuleErrorsFromComponent(component, componentPath));
        errors.push(...validateEventHandlers(component.events, `${componentPath}.events`, ids, component.id));

        configuredComponentSystemIds(form).forEach(systemId => {
          if (!hasComponentSystem(systemId)) return;
          const unsupported = getUnsupportedComponentTypes(systemId, [component.type]);
          if (unsupported.length) {
            warnings.push({
              code: 'COMPONENT_SYSTEM_UNSUPPORTED_TYPE',
              message: `${componentPath}.type "${component.type}" is not mapped for component system "${systemId}"`,
              componentId: component.id,
              componentSystem: systemId,
            });
          }
        });
      });
    });
  });
  errors.push(...validateEventHandlers(form.eventHandlers, 'eventHandlers', ids));

  return { valid: errors.length === 0, errors, warnings };
}

function compilePage(page, form) {
  const pageComponents = (page.components || []).flatMap(component =>
    component.type === 'sectionGroup' ? component.children || [] : component,
  );
  const compiledComponents = pageComponents.map(component => ({
    id: component.id,
    source: component,
    ...compileComponent(component, form),
  }));

  return {
    id: page.id,
    key: toIdentifier(page.id),
    path: page.path || toKebab(page.title || page.id),
    title: page.title,
    bodyText: page.bodyText,
    condition: page.condition,
    components: compiledComponents,
    required: pageComponents
      .filter(component => {
        const compiled = compiledComponents.find(compiledComponent => compiledComponent.id === component.id);
        return component.required && !component.requiredIf && !compiled?.contentOnly;
      })
      .map(component => component.id),
    imports: mergeSets(...compiledComponents.map(component => component.imports)),
    warnings: compiledComponents
      .filter(component => component.warning)
      .map(component => component.warning),
  };
}

function compileChapter(chapter, form) {
  const type = chapter.type || 'standard';
  const pages = (chapter.pages || []).map(page => compilePage(page, form));
  const imports = mergeSets(...pages.map(page => page.imports));

  if (type === 'listLoop') {
    imports.add('arrayBuilderItemFirstPageTitleUI');
    imports.add('arrayBuilderItemSubsequentPageTitleUI');
    imports.add('arrayBuilderYesNoUI');
    imports.add('arrayBuilderYesNoSchema');
    imports.add('textUI');
    imports.add('textSchema');
    imports.add('titleUI');
  } else {
    imports.add('titleUI');
  }

  return {
    id: chapter.id,
    key: toIdentifier(chapter.id),
    type,
    title: chapter.title,
    condition: chapter.condition,
    options: chapter.options || {},
    itemNameLabel: chapter.itemNameLabel,
    sectionIntro: chapter.sectionIntro,
    pages,
    imports,
    warnings: pages.flatMap(page => page.warnings),
  };
}

export function compileAuthoringForm(form) {
  const validation = validateAuthoringForm(form);
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'));
  }

  const chapters = form.chapters.map(chapter => compileChapter(chapter, form));
  const imports = unique(chapters.flatMap(chapter => [...chapter.imports])).sort();
  const usesRules =
    JSON.stringify(form).includes('"showIf"') ||
    JSON.stringify(form).includes('"hideIf"') ||
    JSON.stringify(form).includes('"requiredIf"') ||
    JSON.stringify(form).includes('"validations"') ||
    JSON.stringify(form).includes('"condition"');
  const usesComputedValues =
    Array.isArray(form.computedValues) && form.computedValues.length > 0;
  const componentMetadataById = Object.fromEntries(
    form.chapters
      .flatMap(chapter => chapter.pages.flatMap(page => flattenComponents(page.components)))
      .map(component => [component.id, componentMetadata(component)]),
  );
  const componentEventHandlers = form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page =>
      flattenComponents(page.components).flatMap(component =>
        (component.events || []).map(handler => ({
          ...handler,
          componentId: handler.componentId || component.id,
        })),
      ),
    ),
  );
  const eventHandlers = [...(form.eventHandlers || []), ...componentEventHandlers];
  const usesEvents = eventHandlers.length > 0;

  return {
    source: form,
    metadata: {
      schemaVersion: form.schemaVersion,
      formDefinitionVersion: form.formDefinitionVersion || 1,
      formId: form.formId,
      title: form.title,
      plainLanguageHeader: form.plainLanguageHeader || form.title,
      subTitle: form.subTitle || `${form.title} (VA Form ${form.formId})`,
      trackingPrefix: form.trackingPrefix || `${toKebab(form.formId)}-`,
      rootUrl: form.rootUrl,
      submitUrl: form.submitUrl,
      prefillEnabled: !!form.prefill?.enabled,
      prefillMappings: form.prefill?.mappings || [],
      version: form.version || 0,
      componentSystems: normalizeComponentSystems(form),
      computedValues: form.computedValues || [],
      eventHandlers,
      componentMetadataById,
    },
    chapters,
    imports,
    usesRules,
    usesComputedValues,
    usesEvents,
    warnings: [...validation.warnings, ...chapters.flatMap(chapter => chapter.warnings)],
  };
}
