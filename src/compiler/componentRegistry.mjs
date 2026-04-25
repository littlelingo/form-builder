import { jsValue, raw, toIdentifier } from './utils.mjs';

const ruleFunction = rule => raw(`formData => evaluateAuthoringRule(${jsValue(rule)}, formData)`);

const negatedRuleFunction = rule =>
  raw(`formData => !evaluateAuthoringRule(${jsValue(rule)}, formData)`);

const validationFunction = validation =>
  raw(`(errors, fieldData, formData) => {
  const validationData = { ...(formData || {}), $field: fieldData };
  if (!evaluateAuthoringRule(${jsValue(validation.rule)}, validationData)) {
    errors.addError(${jsValue(validation.message)});
  }
}`);

const contentSchemaKey = component => `view:${component.id}`;

const element = (tag, props, ...children) => {
  const renderedProps = props ? jsValue(props) : 'null';
  const renderedChildren = children.filter(child => child !== undefined && child !== null);
  return `React.createElement(${jsValue(tag)}, ${renderedProps}${
    renderedChildren.length ? `, ${renderedChildren.join(', ')}` : ''
  })`;
};

const textContent = (value, fallback) => jsValue(value || fallback);

const contentUiOptions = component => {
  const hideIf = component.showIf
    ? negatedRuleFunction(component.showIf)
    : component.hideIf
      ? ruleFunction(component.hideIf)
      : undefined;

  return hideIf
    ? `  'ui:options': ${jsValue({ hideIf })},\n`
    : '';
};

const contentOnlyComponent = (component, uiSchemaCode) => ({
  imports: new Set(['titleSchema']),
  schemaKey: contentSchemaKey(component),
  schemaCode: 'titleSchema',
  uiSchemaCode,
  contentOnly: true,
  usesReact: true,
});

const alertClassByType = alertType =>
  `usa-alert usa-alert--${['info', 'warning', 'error', 'success'].includes(alertType) ? alertType : 'info'}`;

const tableRows = rows => (Array.isArray(rows) ? rows : []).filter(Array.isArray);

const renderTableCells = (row, rowIndex, header = false) =>
  row.map((cell, cellIndex) =>
    element(
      header ? 'th' : 'td',
      {
        key: `cell-${cellIndex}`,
        ...(header ? { scope: 'col' } : {}),
      },
      textContent(String(cell), ''),
    ),
  );

const renderTableElement = component => {
  const rows = tableRows(component.rows);
  const hasHeader = component.headerRow !== false && rows.length > 0;
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  return element(
    'table',
    { className: 'usa-table' },
    hasHeader
      ? element(
          'thead',
          null,
          element('tr', { key: 'header' }, ...renderTableCells(rows[0], 0, true)),
        )
      : undefined,
    element(
      'tbody',
      null,
      ...bodyRows.map((row, rowIndex) =>
        element(
          'tr',
          { key: `row-${rowIndex}` },
          ...renderTableCells(row, rowIndex),
        ),
      ),
    ),
  );
};

const dateRangeOrderValidation = component =>
  raw(`(errors, fieldData) => {
  if (fieldData?.startDate && fieldData?.endDate && fieldData.startDate > fieldData.endDate) {
    const target = errors.endDate?.addError ? errors.endDate : errors;
    target.addError(${jsValue(
      component.errorMessages?.dateRangeOrder || 'Enter an end date that is after the start date.',
    )});
  }
}`);

const dateRangePartUi = (component, options) => {
  if (!component.allowFutureDates) {
    return `currentOrPastDateUI(${jsValue(options)})`;
  }

  return jsValue({
    'ui:title': options.title,
    'ui:widget': 'date',
    'ui:required': options.required,
    'ui:errorMessages': {
      pattern: 'Enter a valid date.',
      required: 'Enter a date.',
    },
    'ui:options':
      options.hint || options.hideIf
        ? {
            hint: options.hint,
            hideIf: options.hideIf,
          }
        : undefined,
  });
};

const commonOptions = component => {
  const options = {
    title: component.label,
    hint: component.hint,
    description: component.description,
    errorMessages: component.errorMessages,
    width: component.width,
    inputType: component.inputType,
    autocomplete: component.autocomplete,
    placeholder: component.placeholder,
  };

  if (component.requiredIf) options.required = ruleFunction(component.requiredIf);
  if (component.showIf || component.hideIf) {
    options.hideIf = component.showIf
      ? negatedRuleFunction(component.showIf)
      : ruleFunction(component.hideIf);
  }
  if (component.validations?.length) {
    options.validations = component.validations.map(validationFunction);
  }

  return options;
};

const schemaWithConstraints = (baseSchemaName, component) => {
  const constraints = {
    minLength: component.minLength,
    maxLength: component.maxLength,
    pattern: component.pattern,
    minimum: component.minimum,
    maximum: component.maximum,
  };
  const hasConstraints = Object.values(constraints).some(value => value !== undefined);
  return hasConstraints
    ? `{ ...${baseSchemaName}, ${Object.entries(constraints)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${jsValue(value)}`)
        .join(', ')} }`
    : baseSchemaName;
};

const optionValues = responseOptions =>
  (responseOptions || []).map(option => option.value ?? option.id ?? toIdentifier(option.label));

const optionLabels = responseOptions =>
  (responseOptions || []).reduce((labels, option) => {
    const value = option.value ?? option.id ?? toIdentifier(option.label);
    labels[value] = option.label;
    return labels;
  }, {});

const optionDescriptions = responseOptions =>
  (responseOptions || []).reduce((descriptions, option) => {
    const value = option.value ?? option.id ?? toIdentifier(option.label);
    if (option.description) descriptions[value] = option.description;
    return descriptions;
  }, {});

const checkboxLabels = responseOptions =>
  (responseOptions || []).reduce((labels, option) => {
    const value = option.value ?? option.id ?? toIdentifier(option.label);
    labels[value] = {
      title: option.label,
      description: option.description,
    };
    return labels;
  }, {});

export const componentRegistry = {
  textInput(component) {
    return {
      imports: new Set(['textUI', 'textSchema']),
      schemaCode: schemaWithConstraints('textSchema', component),
      uiSchemaCode: `textUI(${jsValue(commonOptions(component))})`,
    };
  },

  textArea(component) {
    return {
      imports: new Set(['textareaUI', 'textareaSchema']),
      schemaCode: schemaWithConstraints('textareaSchema', component),
      uiSchemaCode: `textareaUI(${jsValue(commonOptions(component))})`,
    };
  },

  characterCount(component) {
    const maxLength = component.maxLength ?? 500;
    return {
      imports: new Set(['textareaUI', 'textareaSchema']),
      schemaCode: schemaWithConstraints('textareaSchema', {
        ...component,
        maxLength,
      }),
      uiSchemaCode: `textareaUI(${jsValue({
        ...commonOptions(component),
        hint: component.hint || `You can enter up to ${maxLength} characters.`,
      })})`,
    };
  },

  maskedInput(component) {
    return {
      imports: new Set(['textUI', 'textSchema']),
      schemaCode: schemaWithConstraints('textSchema', component),
      uiSchemaCode: `textUI(${jsValue({
        ...commonOptions(component),
        inputType: component.inputType || 'text',
      })})`,
    };
  },

  date(component) {
    const monthYear = component.dateFormat === 'month_year';
    const uiName = monthYear ? 'currentOrPastMonthYearDateUI' : 'currentOrPastDateUI';
    const schemaName = monthYear
      ? 'currentOrPastMonthYearDateSchema'
      : 'currentOrPastDateSchema';
    return {
      imports: new Set([uiName, schemaName]),
      schemaCode: schemaName,
      uiSchemaCode: `${uiName}(${jsValue(commonOptions(component))})`,
    };
  },

  memorableDate(component) {
    return {
      imports: new Set(['currentOrPastDateUI', 'currentOrPastDateSchema']),
      schemaCode: 'currentOrPastDateSchema',
      uiSchemaCode: `currentOrPastDateUI(${jsValue(commonOptions(component))})`,
    };
  },

  dateRange(component) {
    const required = component.required && !component.requiredIf
      ? `,\n  required: ['startDate', 'endDate']`
      : '';
    const imports = ['currentOrPastDateSchema'];
    if (!component.allowFutureDates) imports.push('currentOrPastDateUI');
    const childVisibility = {
      required: component.requiredIf ? ruleFunction(component.requiredIf) : undefined,
      hideIf: component.showIf
        ? negatedRuleFunction(component.showIf)
        : component.hideIf
          ? ruleFunction(component.hideIf)
          : undefined,
    };
    return {
      imports: new Set(imports),
      schemaCode: `{
  type: 'object',
  properties: {
    startDate: currentOrPastDateSchema,
    endDate: currentOrPastDateSchema,
  }${required}
}`,
      uiSchemaCode: `{
  'ui:title': ${jsValue(component.label)},
  'ui:validations': ${jsValue([dateRangeOrderValidation(component)])},
  startDate: ${dateRangePartUi(component, {
    ...childVisibility,
    title: component.startLabel || 'Start date',
    hint: component.startHint,
  })},
  endDate: ${dateRangePartUi(component, {
    ...childVisibility,
    title: component.endLabel || 'End date',
    hint: component.endHint,
  })},
}`,
    };
  },

  radioButton(component) {
    const values = optionValues(component.responseOptions);
    const descriptions = optionDescriptions(component.responseOptions);
    return {
      imports: new Set(['radioUI', 'radioSchema']),
      schemaCode: `radioSchema(${jsValue(values)})`,
      uiSchemaCode: `radioUI(${jsValue({
        ...commonOptions(component),
        labels: optionLabels(component.responseOptions),
        descriptions: Object.keys(descriptions).length ? descriptions : undefined,
        tile: Object.keys(descriptions).length > 0 || undefined,
      })})`,
    };
  },

  select(component) {
    const values = optionValues(component.responseOptions);
    return {
      imports: new Set(['selectUI', 'selectSchema']),
      schemaCode: `selectSchema(${jsValue(values)})`,
      uiSchemaCode: `selectUI(${jsValue({
        ...commonOptions(component),
        labels: optionLabels(component.responseOptions),
      })})`,
    };
  },

  checkbox(component) {
    const values = optionValues(component.responseOptions);
    return {
      imports: new Set(['checkboxGroupUI', 'checkboxGroupSchema']),
      schemaCode: `checkboxGroupSchema(${jsValue(values)})`,
      uiSchemaCode: `checkboxGroupUI(${jsValue({
        ...commonOptions(component),
        labels: checkboxLabels(component.responseOptions),
        required: component.required,
        tile: (component.responseOptions || []).some(option => option.description) || undefined,
      })})`,
    };
  },

  fileUpload(component, form) {
    const multiple = !!component.multiple;
    const uiName = multiple ? 'fileInputMultipleUI' : 'fileInputUI';
    const schemaName = multiple ? 'fileInputMultipleSchema' : 'fileInputSchema';
    const required = component.requiredIf
      ? ruleFunction(component.requiredIf)
      : !!component.required;
    return {
      imports: new Set([uiName, schemaName]),
      schemaCode: `${schemaName}()`,
      uiSchemaCode: `${uiName}(${jsValue({
        ...commonOptions(component),
        required,
        accept: component.accept,
        maxFileSize: component.maxFileSize,
        minFileSize: component.minFileSize,
        maxFileCount: component.maxFileCount,
        fileUploadUrl: component.fileUploadUrl || component.endpoint,
        formNumber: component.formNumber || form.formId,
        skipUpload: component.skipUpload,
        disallowEncryptedPdfs: component.disallowEncryptedPdfs,
      })})`,
    };
  },

  address(component) {
    const noMilitary = component.militaryAddress === false;
    const uiName = noMilitary ? 'addressNoMilitaryUI' : 'addressUI';
    const schemaName = noMilitary ? 'addressNoMilitarySchema' : 'addressSchema';
    const options = {
      omit: component.omit,
      labels: component.labels,
    };
    return {
      imports: new Set([uiName, schemaName]),
      schemaCode: `${schemaName}(${jsValue(options)})`,
      uiSchemaCode: `${uiName}(${jsValue(options)})`,
    };
  },

  phone(component) {
    return {
      imports: new Set(['phoneUI', 'phoneSchema']),
      schemaCode: 'phoneSchema',
      uiSchemaCode: `phoneUI(${jsValue(commonOptions(component))})`,
    };
  },

  email(component) {
    return {
      imports: new Set(['emailUI', 'emailSchema']),
      schemaCode: 'emailSchema',
      uiSchemaCode: `emailUI(${jsValue(commonOptions(component))})`,
    };
  },

  yesNo(component) {
    return {
      imports: new Set(['yesNoUI', 'yesNoSchema']),
      schemaCode: 'yesNoSchema',
      uiSchemaCode: `yesNoUI(${jsValue(commonOptions(component))})`,
    };
  },

  prose(component) {
    return contentOnlyComponent(
      component,
      `{
  'ui:title': ${element(
    'div',
    { className: 'usa-prose' },
    element('h3', null, textContent(component.label, 'Information')),
    element('p', null, textContent(component.description || component.hint, 'Instructional text.')),
  )},
${contentUiOptions(component)}}`,
    );
  },

  alert(component) {
    return contentOnlyComponent(
      component,
      `{
  'ui:title': ${element(
    'div',
    { className: alertClassByType(component.alertType) },
    element(
      'div',
      { className: 'usa-alert__body' },
      element('h3', { className: 'usa-alert__heading' }, textContent(component.label, 'Information')),
      element(
        'p',
        { className: 'usa-alert__text' },
        textContent(component.description || component.hint, 'Important information.'),
      ),
    ),
  )},
${contentUiOptions(component)}}`,
    );
  },

  summaryBox(component) {
    return contentOnlyComponent(
      component,
      `{
  'ui:title': ${element(
    'div',
    { className: 'usa-summary-box' },
    element(
      'div',
      { className: 'usa-summary-box__body' },
      element('h3', { className: 'usa-summary-box__heading' }, textContent(component.label, 'Summary')),
      element('p', null, textContent(component.description || component.hint, 'Summary content.')),
    ),
  )},
${contentUiOptions(component)}}`,
    );
  },

  table(component) {
    return contentOnlyComponent(
      component,
      `{
  'ui:title': ${jsValue(component.label)},
  'ui:description': ${renderTableElement(component)},
${contentUiOptions(component)}}`,
    );
  },
};

export function compileComponent(component, form) {
  const compiler = componentRegistry[component.type];
  if (!compiler) {
    return {
      imports: new Set(),
      unsupported: true,
      schemaCode: '{}',
      uiSchemaCode: '{}',
      warning: {
        code: 'UNSUPPORTED_COMPONENT',
        message: `Component "${component.id}" uses unsupported type "${component.type}"`,
        componentId: component.id,
      },
    };
  }

  return compiler(component, form);
}
