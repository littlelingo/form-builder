function toId(value, fallback) {
  const id = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join('');

  return id || fallback;
}

function uniqueId(baseId, existingIds) {
  let id = baseId;
  let count = 2;

  while (existingIds.has(id)) {
    id = `${baseId}${count}`;
    count += 1;
  }

  return id;
}

function createComponent(type, existingIds) {
  const baseId =
    type === 'textInput' ? 'newTextField' : `new${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  const component = {
    id: uniqueId(baseId, existingIds),
    type,
    label: 'New field',
  };

  if (type === 'phone') {
    component.inputType = 'tel';
    component.autocomplete = 'tel';
    component.placeholder = '(555) 555-5555';
    component.pattern = '^\\(\\d{3}\\) \\d{3}-\\d{4}$';
    component.maxLength = 14;
  }

  if (type === 'maskedInput') {
    component.placeholder = 'XXX-XX-XXXX';
    component.pattern = '^\\d{3}-\\d{2}-\\d{4}$';
    component.maxLength = 11;
    component.inputType = 'text';
    component.allowReveal = true;
  }

  return component;
}

function createComponentWithId(type, label, existingIds, options = {}) {
  const requestedId = typeof options.id === 'string' ? options.id : toId(label, type);
  const id = uniqueId(requestedId, existingIds);
  existingIds.add(id);
  const componentOptions = { ...options };
  delete componentOptions.id;

  return {
    ...createComponent(type, existingIds),
    id,
    label,
    ...componentOptions,
  };
}

export function createHelperTemplateScreen(templateId, existingPageIds, existingComponentIds) {
  if (templateId === 'contact') {
    return {
      id: uniqueId('contactScreen', existingPageIds),
      title: 'Your contact information',
      bodyText: 'We will use this information if we need to contact you about this application.',
      components: [
        createComponentWithId('address', 'Current mailing address', existingComponentIds, {
          required: true,
          summaryCard: true,
        }),
        createComponentWithId('email', 'Email address', existingComponentIds, {
          required: true,
          hint: 'Enter an email address we can use to contact you about this application.',
          autocomplete: 'email',
          layoutWidth: 'half',
        }),
        createComponentWithId('phone', 'Phone number', existingComponentIds, {
          required: true,
          hint: 'Enter a 10 digit phone number.',
          autocomplete: 'tel',
          layoutWidth: 'half',
        }),
      ],
    };
  }

  if (templateId === 'identity') {
    return {
      id: uniqueId('identityScreen', existingPageIds),
      title: 'Your identity information',
      bodyText: 'Tell us about the person this application is for.',
      components: [
        createComponentWithId('textInput', 'Full name', existingComponentIds, {
          required: true,
          hint: 'Enter first, middle, and last name.',
          autocomplete: 'name',
          summaryCard: true,
        }),
        createComponentWithId('memorableDate', 'Date of birth', existingComponentIds, {
          required: true,
          hint: 'Enter the month, day, and year.',
          layoutWidth: 'half',
        }),
        createComponentWithId('maskedInput', 'Social Security number', existingComponentIds, {
          hint: 'Enter 9 digits with no dashes. Leave blank if this form should use a VA file number instead.',
          placeholder: '123456789',
          pattern: '^\\d{9}$',
          maxLength: 9,
          layoutWidth: 'half',
          errorMessages: {
            pattern: 'Enter 9 digits with no dashes.',
          },
        }),
        createComponentWithId('maskedInput', 'VA file number', existingComponentIds, {
          id: 'vaFileNumber',
          hint: 'Enter 8 or 9 digits if VA assigned a file number.',
          placeholder: '12345678',
          pattern: '^\\d{8,9}$',
          maxLength: 9,
          layoutWidth: 'half',
          errorMessages: {
            pattern: 'Enter 8 or 9 digits.',
          },
        }),
      ],
    };
  }

  return null;
}

function nestedComponents(component) {
  return component.children || [];
}

function flattenComponents(components) {
  return components.flatMap(component => [component, ...flattenComponents(nestedComponents(component))]);
}

function componentByType(components, type) {
  return flattenComponents(components).find(component => component.type === type);
}

function componentByLabel(components, pattern) {
  return flattenComponents(components).find(component => pattern.test(component.label));
}

function sameSources(first = [], second = []) {
  return (
    first.length === second.length &&
    first.every((source, index) => source === second[index])
  );
}

function uniqueComputedId(baseId, computedValues) {
  return uniqueId(baseId, new Set(computedValues.map(definition => definition.id)));
}

function uniqueComputedTarget(baseTarget, computedValues) {
  return uniqueId(baseTarget, new Set(computedValues.map(definition => definition.target)));
}

function allPageIds(form) {
  return new Set(form.chapters.flatMap(chapter => chapter.pages.map(page => page.id)));
}

function allComponentIds(form) {
  return new Set(
    form.chapters.flatMap(chapter =>
      chapter.pages.flatMap(page => flattenComponents(page.components).map(component => component.id)),
    ),
  );
}

function newPrefillMappingPreviews(form, mappings) {
  const existingMappings = form.prefill?.mappings || [];
  return mappings
    .filter(mapping => Boolean(mapping.target && mapping.targetLabel))
    .filter(
      mapping =>
        !existingMappings.some(item => item.source === mapping.source && item.target === mapping.target),
    )
    .map(mapping => ({
      source: mapping.source,
      target: mapping.target,
      targetLabel: mapping.targetLabel,
    }));
}

function newComputedValuePreview(form, definition, components) {
  if (!definition.sources?.length) return undefined;
  const computedValues = form.computedValues || [];
  const existing = computedValues.some(
    item => item.operation === definition.operation && sameSources(item.sources, definition.sources),
  );
  if (existing) return undefined;

  return {
    id: uniqueComputedId(definition.id, computedValues),
    target: uniqueComputedTarget(definition.target, computedValues),
    sources: definition.sources,
    sourceLabels: definition.sources.map(
      source => flattenComponents(components).find(component => component.id === source)?.label || source,
    ),
  };
}

function previewContactTemplateHelpers(form, components) {
  const address = componentByType(components, 'address');
  const email = componentByType(components, 'email');
  const phone = componentByType(components, 'phone');
  const summarySources = [email?.id, phone?.id].filter(Boolean);
  const computed = newComputedValuePreview(form, {
    id: 'contactSummary',
    target: 'metadata.contactSummary',
    operation: 'concat',
    sources: summarySources,
    separator: ' | ',
  }, components);

  return {
    prefill: newPrefillMappingPreviews(form, [
      { source: 'profile.mailingAddress', target: address?.id, targetLabel: address?.label },
      { source: 'profile.email', target: email?.id, targetLabel: email?.label },
      { source: 'profile.phone', target: phone?.id, targetLabel: phone?.label },
    ]),
    computed: computed ? [computed] : [],
  };
}

function previewIdentityTemplateHelpers(form, components) {
  const fullName = componentByLabel(components, /^Full name$/i);
  const dateOfBirth = componentByLabel(components, /date of birth/i);
  const ssn = componentByLabel(components, /social security number/i);
  const vaFileNumber = componentByLabel(components, /VA file number/i);
  const summarySources = [fullName?.id, dateOfBirth?.id].filter(Boolean);
  const computed = newComputedValuePreview(form, {
    id: 'identitySummary',
    target: 'metadata.identitySummary',
    operation: 'concat',
    sources: summarySources,
    separator: ' | ',
  }, components);

  return {
    prefill: newPrefillMappingPreviews(form, [
      { source: 'profile.fullName', target: fullName?.id, targetLabel: fullName?.label },
      { source: 'profile.dateOfBirth', target: dateOfBirth?.id, targetLabel: dateOfBirth?.label },
      { source: 'profile.ssn', target: ssn?.id, targetLabel: ssn?.label },
      { source: 'profile.vaFileNumber', target: vaFileNumber?.id, targetLabel: vaFileNumber?.label },
    ]),
    computed: computed ? [computed] : [],
  };
}

export function previewTemplateAuthoringHelpers(form) {
  return [
    {
      templateId: 'contact',
      templateLabel: 'Contact information',
    },
    {
      templateId: 'identity',
      templateLabel: 'Identity',
    },
  ].map(template => {
    const page = createHelperTemplateScreen(
      template.templateId,
      new Set(allPageIds(form)),
      new Set(allComponentIds(form)),
    );
    const helpers =
      template.templateId === 'contact'
        ? previewContactTemplateHelpers(form, page.components)
        : previewIdentityTemplateHelpers(form, page.components);
    return {
      ...template,
      ...helpers,
    };
  });
}
