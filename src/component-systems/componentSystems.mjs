export const supportedComponentTypes = [
  'textInput',
  'textArea',
  'characterCount',
  'inputGroup',
  'maskedInput',
  'date',
  'dateRange',
  'memorableDate',
  'timePicker',
  'radioButton',
  'select',
  'comboBox',
  'checkbox',
  'switch',
  'rangeSlider',
  'fileUpload',
  'address',
  'phone',
  'email',
  'search',
  'yesNo',
  'alert',
  'summaryBox',
  'accordion',
  'card',
  'prose',
  'table',
  'tag',
  'processList',
  'button',
  'buttonGroup',
  'sectionGroup',
];

export const componentSystems = {
  uswds: {
    id: 'uswds',
    name: 'U.S. Web Design System',
    role: 'primary-preview',
    docs: 'https://designsystem.digital.gov/components/',
    components: {
      textInput: {
        component: 'Text input',
        implementation: 'input.usa-input',
        docs: 'https://designsystem.digital.gov/components/text-input/',
      },
      textArea: {
        component: 'Textarea',
        implementation: 'textarea.usa-textarea',
        docs: 'https://designsystem.digital.gov/components/textarea/',
      },
      characterCount: {
        component: 'Character count',
        implementation: 'textarea.usa-textarea + character count guidance',
        docs: 'https://designsystem.digital.gov/components/character-count/',
      },
      inputGroup: {
        component: 'Input prefix or suffix',
        implementation: 'usa-input + affix container',
        docs: 'https://designsystem.digital.gov/components/input-prefix-suffix/',
      },
      maskedInput: {
        component: 'Text input',
        implementation: 'input.usa-input with validation pattern',
        docs: 'https://designsystem.digital.gov/components/text-input/',
      },
      date: {
        component: 'Date picker',
        implementation: 'div.usa-date-picker + input.usa-input',
        docs: 'https://designsystem.digital.gov/components/date-picker/',
      },
      dateRange: {
        component: 'Date range picker',
        implementation: 'usa-date-range-picker',
        docs: 'https://designsystem.digital.gov/components/date-range-picker/',
      },
      memorableDate: {
        component: 'Memorable date',
        implementation: 'usa-memorable-date',
        docs: 'https://designsystem.digital.gov/components/memorable-date/',
      },
      timePicker: {
        component: 'Time picker',
        implementation: 'usa-time-picker',
        docs: 'https://designsystem.digital.gov/components/time-picker/',
      },
      radioButton: {
        component: 'Radio buttons',
        implementation: 'fieldset.usa-fieldset + input.usa-radio__input',
        docs: 'https://designsystem.digital.gov/components/radio-buttons/',
      },
      select: {
        component: 'Select',
        implementation: 'select.usa-select',
        docs: 'https://designsystem.digital.gov/components/select/',
      },
      comboBox: {
        component: 'Combo box',
        implementation: 'usa-combo-box',
        docs: 'https://designsystem.digital.gov/components/combo-box/',
      },
      checkbox: {
        component: 'Checkbox',
        implementation: 'fieldset.usa-fieldset + input.usa-checkbox__input',
        docs: 'https://designsystem.digital.gov/components/checkbox/',
      },
      fileUpload: {
        component: 'File input',
        implementation: 'input.usa-file-input',
        docs: 'https://designsystem.digital.gov/components/file-input/',
      },
      address: {
        component: 'Address form group',
        implementation: 'usa-form-group composed from text input and select',
        docs: 'https://designsystem.digital.gov/components/form/',
      },
      phone: {
        component: 'Text input',
        implementation: 'input.usa-input[type="tel"]',
        docs: 'https://designsystem.digital.gov/components/text-input/',
      },
      email: {
        component: 'Text input',
        implementation: 'input.usa-input[type="email"]',
        docs: 'https://designsystem.digital.gov/components/text-input/',
      },
      yesNo: {
        component: 'Radio buttons',
        implementation: 'fieldset.usa-fieldset + two input.usa-radio__input controls',
        docs: 'https://designsystem.digital.gov/components/radio-buttons/',
      },
      switch: {
        component: 'Checkbox',
        implementation: 'input.usa-checkbox__input rendered as switch-style binary input',
        docs: 'https://designsystem.digital.gov/components/checkbox/',
      },
      rangeSlider: {
        component: 'Range slider',
        implementation: 'input[type="range"]',
        docs: 'https://designsystem.digital.gov/components/range-slider/',
      },
      search: {
        component: 'Search',
        implementation: 'form.usa-search + input.usa-input[type="search"]',
        docs: 'https://designsystem.digital.gov/components/search/',
      },
      alert: {
        component: 'Alert',
        implementation: 'div.usa-alert',
        docs: 'https://designsystem.digital.gov/components/alert/',
      },
      summaryBox: {
        component: 'Summary box',
        implementation: 'div.usa-summary-box',
        docs: 'https://designsystem.digital.gov/components/summary-box/',
      },
      accordion: {
        component: 'Accordion',
        implementation: 'div.usa-accordion',
        docs: 'https://designsystem.digital.gov/components/accordion/',
      },
      card: {
        component: 'Card',
        implementation: 'div.usa-card',
        docs: 'https://designsystem.digital.gov/components/card/',
      },
      prose: {
        component: 'Prose',
        implementation: 'div.usa-prose',
        docs: 'https://designsystem.digital.gov/components/prose/',
      },
      table: {
        component: 'Table',
        implementation: 'table.usa-table',
        docs: 'https://designsystem.digital.gov/components/table/',
      },
      tag: {
        component: 'Tag',
        implementation: 'span.usa-tag',
        docs: 'https://designsystem.digital.gov/components/tag/',
      },
      processList: {
        component: 'Process list',
        implementation: 'ol.usa-process-list',
        docs: 'https://designsystem.digital.gov/components/process-list/',
      },
      button: {
        component: 'Button',
        implementation: 'button.usa-button',
        docs: 'https://designsystem.digital.gov/components/button/',
      },
      buttonGroup: {
        component: 'Button group',
        implementation: 'ul.usa-button-group',
        docs: 'https://designsystem.digital.gov/components/button-group/',
      },
      sectionGroup: {
        component: 'Fieldset',
        implementation: 'section/fieldset grouping child components',
        docs: 'https://designsystem.digital.gov/components/form/',
      },
    },
  },

  vaFormsSystem: {
    id: 'vaFormsSystem',
    name: 'VA forms-system web-component patterns',
    role: 'generated-va-code',
    docs: 'vets-website-main/src/platform/forms-system/src/js/web-component-patterns',
    components: {
      textInput: { component: 'textUI/textSchema' },
      textArea: { component: 'textareaUI/textareaSchema' },
      characterCount: { component: 'textareaUI/textareaSchema with maxLength' },
      inputGroup: { component: 'textUI/textSchema with prefix/suffix custom UI' },
      maskedInput: { component: 'textUI/textSchema with pattern' },
      date: { component: 'currentOrPastDateUI/currentOrPastDateSchema' },
      dateRange: { component: 'currentOrPastDateUI/currentOrPastDateSchema pair' },
      memorableDate: { component: 'currentOrPastDateUI/currentOrPastDateSchema' },
      timePicker: { component: 'textUI/textSchema with time input' },
      radioButton: { component: 'radioUI/radioSchema' },
      select: { component: 'selectUI/selectSchema' },
      comboBox: { component: 'selectUI/selectSchema or custom combo box' },
      checkbox: { component: 'checkboxGroupUI/checkboxGroupSchema' },
      switch: { component: 'yesNoUI/yesNoSchema' },
      rangeSlider: { component: 'textUI/textSchema with numeric range validation' },
      fileUpload: { component: 'fileInputUI/fileInputSchema' },
      address: { component: 'addressUI/addressSchema' },
      phone: { component: 'phoneUI/phoneSchema' },
      email: { component: 'emailUI/emailSchema' },
      search: { component: 'textUI/textSchema with search input' },
      yesNo: { component: 'yesNoUI/yesNoSchema' },
      alert: { component: 'ui:title/content-only alert' },
      summaryBox: { component: 'ui:title/content-only summary box' },
      accordion: { component: 'content-only accordion' },
      card: { component: 'content-only card' },
      prose: { component: 'ui:title/content-only prose' },
      table: { component: 'content-only table' },
      tag: { component: 'content-only tag' },
      processList: { component: 'content-only process list' },
      button: { component: 'content/action-only button' },
      buttonGroup: { component: 'content/action-only button group' },
      sectionGroup: { component: 'grouping container; compiler flattens child fields' },
    },
  },

  shadcn: {
    id: 'shadcn',
    name: 'shadcn/ui',
    role: 'optional-preview',
    docs: 'https://ui.shadcn.com/docs/components',
    baseImports: ['field', 'label'],
    components: {
      textInput: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      textArea: {
        component: 'Textarea',
        registryItems: ['textarea', 'field'],
        importPath: '@/components/ui/textarea',
      },
      characterCount: {
        component: 'Textarea',
        registryItems: ['textarea', 'field'],
        importPath: '@/components/ui/textarea',
      },
      inputGroup: {
        component: 'InputGroup',
        registryItems: ['input-group', 'input', 'field'],
        importPath: '@/components/ui/input-group',
      },
      maskedInput: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      date: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
        note: 'Use type="date" for MVP; upgrade to Calendar/Popover date picker only when VA accessibility review approves it.',
      },
      dateRange: {
        component: 'Calendar',
        registryItems: ['calendar', 'popover', 'field'],
        importPath: '@/components/ui/calendar',
      },
      memorableDate: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      timePicker: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      radioButton: {
        component: 'RadioGroup',
        registryItems: ['radio-group', 'field'],
        importPath: '@/components/ui/radio-group',
      },
      select: {
        component: 'Select',
        registryItems: ['select', 'field'],
        importPath: '@/components/ui/select',
      },
      comboBox: {
        component: 'Combobox',
        registryItems: ['command', 'popover', 'button', 'field'],
        importPath: '@/components/ui/command',
      },
      checkbox: {
        component: 'Checkbox',
        registryItems: ['checkbox', 'field', 'label'],
        importPath: '@/components/ui/checkbox',
      },
      switch: {
        component: 'Switch',
        registryItems: ['switch', 'field'],
        importPath: '@/components/ui/switch',
      },
      rangeSlider: {
        component: 'Slider',
        registryItems: ['slider', 'field'],
        importPath: '@/components/ui/slider',
      },
      fileUpload: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
        note: 'Render as <Input type="file"> with VA-compatible validation and upload behavior.',
      },
      address: {
        component: 'FieldGroup',
        registryItems: ['field', 'input', 'select'],
        importPath: '@/components/ui/field',
      },
      search: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      phone: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      email: {
        component: 'Input',
        registryItems: ['input', 'field'],
        importPath: '@/components/ui/input',
      },
      yesNo: {
        component: 'RadioGroup',
        registryItems: ['radio-group', 'field'],
        importPath: '@/components/ui/radio-group',
      },
      alert: {
        component: 'Alert',
        registryItems: ['alert'],
        importPath: '@/components/ui/alert',
      },
      summaryBox: {
        component: 'Card',
        registryItems: ['card'],
        importPath: '@/components/ui/card',
      },
      accordion: {
        component: 'Accordion',
        registryItems: ['accordion'],
        importPath: '@/components/ui/accordion',
      },
      card: {
        component: 'Card',
        registryItems: ['card'],
        importPath: '@/components/ui/card',
      },
      prose: {
        component: 'Typography',
        registryItems: ['typography'],
        importPath: '@/components/ui/typography',
      },
      table: {
        component: 'Table',
        registryItems: ['table'],
        importPath: '@/components/ui/table',
      },
      tag: {
        component: 'Badge',
        registryItems: ['badge'],
        importPath: '@/components/ui/badge',
      },
      processList: {
        component: 'List',
        registryItems: ['card'],
        importPath: '@/components/ui/card',
      },
      button: {
        component: 'Button',
        registryItems: ['button'],
        importPath: '@/components/ui/button',
      },
      buttonGroup: {
        component: 'Button',
        registryItems: ['button'],
        importPath: '@/components/ui/button',
      },
      sectionGroup: {
        component: 'FieldGroup',
        registryItems: ['field'],
        importPath: '@/components/ui/field',
      },
    },
  },
};

export function getComponentSystem(id = 'uswds') {
  return componentSystems[id];
}

export function hasComponentSystem(id) {
  return Boolean(getComponentSystem(id));
}

export function getComponentSystemSupport(componentType) {
  return Object.fromEntries(
    Object.entries(componentSystems).map(([systemId, system]) => [
      systemId,
      system.components[componentType] || null,
    ]),
  );
}

export function getUnsupportedComponentTypes(componentSystemId, componentTypes) {
  const system = getComponentSystem(componentSystemId);
  if (!system) return [...componentTypes];

  return [...componentTypes].filter(type => !system.components[type]);
}
