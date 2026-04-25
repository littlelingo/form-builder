import type {
  AuthoringChapter,
  AuthoringComponent,
  AuthoringForm,
  AuthoringPage,
  AuthoringRule,
  ComputedValueDefinition,
  PaletteComponent,
  SavedCustomTemplate,
  SelectedNode,
} from '../types';
import {
  createHelperTemplateScreen,
  previewTemplateAuthoringHelpers as previewTemplateAuthoringHelpersCore,
} from './templateHelperPreview';

export type LayoutWidth = 'full' | 'half' | 'third';
type ReusableSectionTemplateId =
  | 'contact'
  | 'identity'
  | 'claimantVeteran'
  | 'evidence'
  | 'certification'
  | 'yesNoDetails';
type ListSectionTemplateId = 'repeatable' | 'employmentLoop' | 'dependentLoop';
export type SectionTemplateId = 'standard' | ReusableSectionTemplateId | ListSectionTemplateId;
export type ScreenTemplateId = 'blank' | ReusableSectionTemplateId;
export interface TemplateInsertionOptions {
  includeAuthoringHelpers?: boolean;
}
type HelperPresetTemplateId = 'contact' | 'identity';
export interface TemplateHelperMappingPreview {
  source: string;
  target: string;
  targetLabel: string;
}
export interface TemplateHelperComputedPreview {
  id: string;
  target: string;
  sources: string[];
  sourceLabels: string[];
}
export interface TemplateHelperPreview {
  templateId: HelperPresetTemplateId;
  templateLabel: string;
  prefill: TemplateHelperMappingPreview[];
  computed: TemplateHelperComputedPreview[];
}

export const paletteCategories = [
  { id: 'fields', label: 'Fields' },
  { id: 'choice', label: 'Choice' },
  { id: 'dateTime', label: 'Date/time' },
  { id: 'identity', label: 'Identity' },
  { id: 'content', label: 'Content' },
  { id: 'actions', label: 'Actions' },
] satisfies Array<{ id: string; label: string }>;

export const paletteComponents: PaletteComponent[] = [
  {
    type: 'textInput',
    label: 'Text input',
    description: 'Short text, number, or simple typed response.',
    category: 'fields',
  },
  {
    type: 'textArea',
    label: 'Textarea',
    description: 'Longer free-text response.',
    category: 'fields',
  },
  {
    type: 'characterCount',
    label: 'Character count',
    description: 'Textarea with remaining-character guidance.',
    category: 'fields',
  },
  {
    type: 'inputGroup',
    label: 'Input group',
    description: 'Text input with prefix or suffix content.',
    category: 'fields',
    status: 'previewOnly',
  },
  {
    type: 'maskedInput',
    label: 'Masked input',
    description: 'Formatted text input such as SSN or ZIP.',
    category: 'fields',
  },
  {
    type: 'date',
    label: 'Date',
    description: 'Current or past date.',
    category: 'dateTime',
  },
  {
    type: 'dateRange',
    label: 'Date range',
    description: 'Start and end date fields.',
    category: 'dateTime',
  },
  {
    type: 'memorableDate',
    label: 'Memorable date',
    description: 'Month, day, and year grouped inputs.',
    category: 'dateTime',
  },
  {
    type: 'timePicker',
    label: 'Time picker',
    description: 'Time entry field.',
    category: 'dateTime',
    status: 'previewOnly',
  },
  {
    type: 'radioButton',
    label: 'Radio buttons',
    description: 'Single choice shown as radio options.',
    category: 'choice',
  },
  {
    type: 'select',
    label: 'Select',
    description: 'Single choice shown as a dropdown/select.',
    category: 'choice',
  },
  {
    type: 'comboBox',
    label: 'Combo box',
    description: 'Searchable select-style choice.',
    category: 'choice',
    status: 'previewOnly',
  },
  {
    type: 'checkbox',
    label: 'Checkbox group',
    description: 'Multiple-choice selection.',
    category: 'choice',
  },
  {
    type: 'yesNo',
    label: 'Yes/No',
    description: 'Boolean yes/no question.',
    category: 'choice',
  },
  {
    type: 'switch',
    label: 'Switch',
    description: 'On/off choice.',
    category: 'choice',
    status: 'previewOnly',
  },
  {
    type: 'rangeSlider',
    label: 'Range slider',
    description: 'Numeric value selected from a range.',
    category: 'choice',
    status: 'previewOnly',
  },
  {
    type: 'fileUpload',
    label: 'File upload',
    description: 'Single or multiple document attachments.',
    category: 'identity',
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Email address field.',
    category: 'identity',
  },
  {
    type: 'phone',
    label: 'Phone',
    description: 'Phone number field.',
    category: 'identity',
  },
  {
    type: 'address',
    label: 'Address',
    description: 'Structured mailing address.',
    category: 'identity',
  },
  {
    type: 'search',
    label: 'Search',
    description: 'Search input for filtering or lookup.',
    category: 'fields',
    status: 'previewOnly',
  },
  {
    type: 'alert',
    label: 'Alert',
    description: 'Status, warning, error, or information message.',
    category: 'content',
  },
  {
    type: 'summaryBox',
    label: 'Summary box',
    description: 'Highlighted explanatory content.',
    category: 'content',
  },
  {
    type: 'accordion',
    label: 'Accordion',
    description: 'Expandable content panel.',
    category: 'content',
    status: 'previewOnly',
  },
  {
    type: 'card',
    label: 'Card',
    description: 'Grouped content block.',
    category: 'content',
    status: 'previewOnly',
  },
  {
    type: 'prose',
    label: 'Text content',
    description: 'Body copy, instructions, or helper text.',
    category: 'content',
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Simple comparison or review table.',
    category: 'content',
  },
  {
    type: 'tag',
    label: 'Tag',
    description: 'Short status label.',
    category: 'content',
    status: 'previewOnly',
  },
  {
    type: 'processList',
    label: 'Process list',
    description: 'Ordered steps or process guidance.',
    category: 'content',
    status: 'previewOnly',
  },
  {
    type: 'button',
    label: 'Button',
    description: 'Action button.',
    category: 'actions',
    status: 'previewOnly',
  },
  {
    type: 'buttonGroup',
    label: 'Button group',
    description: 'Grouped primary and secondary actions.',
    category: 'actions',
    status: 'previewOnly',
  },
];

function nestedComponents(component: AuthoringComponent) {
  return component.children || [];
}

function flattenComponents(components: AuthoringComponent[]): AuthoringComponent[] {
  return components.flatMap(component => [component, ...flattenComponents(nestedComponents(component))]);
}

function findComponentInList(components: AuthoringComponent[], componentId?: string): AuthoringComponent | undefined {
  if (!componentId) return undefined;
  for (const component of components) {
    if (component.id === componentId) return component;
    const child = findComponentInList(nestedComponents(component), componentId);
    if (child) return child;
  }
  return undefined;
}

function updateComponentsRecursive(
  components: AuthoringComponent[],
  componentId: string | undefined,
  updater: (component: AuthoringComponent) => AuthoringComponent,
): AuthoringComponent[] {
  return components.map(component => {
    if (component.id === componentId) return updater(component);
    if (component.children?.length) {
      return {
        ...component,
        children: updateComponentsRecursive(component.children, componentId, updater),
      };
    }
    return component;
  });
}

function removeComponentsRecursive(
  components: AuthoringComponent[],
  componentId: string | undefined,
): AuthoringComponent[] {
  return components
    .filter(component => component.id !== componentId)
    .map(component =>
      component.children?.length
        ? {
            ...component,
            children: removeComponentsRecursive(component.children, componentId),
          }
        : component,
    );
}

function duplicateComponentsRecursive(
  components: AuthoringComponent[],
  componentId: string | undefined,
  duplicate: AuthoringComponent,
): { components: AuthoringComponent[]; inserted: boolean } {
  const index = components.findIndex(component => component.id === componentId);
  if (index >= 0) {
    const nextComponents = [...components];
    nextComponents.splice(index + 1, 0, duplicate);
    return { components: nextComponents, inserted: true };
  }

  let inserted = false;
  const nextComponents = components.map(component => {
    if (!component.children?.length || inserted) return component;
    const result = duplicateComponentsRecursive(component.children, componentId, duplicate);
    if (!result.inserted) return component;
    inserted = true;
    return {
      ...component,
      children: result.components,
    };
  });

  return { components: nextComponents, inserted };
}

function collectComponentIds(components: AuthoringComponent[], ids: string[] = []) {
  components.forEach(component => {
    ids.push(component.id);
    collectComponentIds(nestedComponents(component), ids);
  });
  return ids;
}

function freshComponentIdMap(components: AuthoringComponent[], existingIds: Set<string>) {
  const idMap = new Map<string, string>();
  collectComponentIds(components).forEach(id => {
    const nextId = uniqueId(id, existingIds);
    existingIds.add(nextId);
    idMap.set(id, nextId);
  });
  return idMap;
}

function rewriteIdReference(value: string, idMap: Map<string, string>) {
  const direct = idMap.get(value);
  if (direct) return direct;

  const [first, ...rest] = value.split('.');
  const mapped = idMap.get(first);
  return mapped ? [mapped, ...rest].join('.') : value;
}

function cloneWithFreshComponentIds<T>(value: T, idMap: Map<string, string>): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneWithFreshComponentIds(item, idMap)) as T;
  }

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (
        typeof entryValue === 'string' &&
        ['id', 'field', 'target', 'source', 'componentId'].includes(key)
      ) {
        return [key, rewriteIdReference(entryValue, idMap)];
      }
      return [key, cloneWithFreshComponentIds(entryValue, idMap)];
    }),
  ) as T;
}

function instantiateCustomComponents(
  components: AuthoringComponent[],
  existingIds: Set<string>,
) {
  const idMap = freshComponentIdMap(components, existingIds);
  return cloneWithFreshComponentIds(components, idMap);
}

function componentByType(components: AuthoringComponent[], type: string) {
  return flattenComponents(components).find(component => component.type === type);
}

function componentByLabel(components: AuthoringComponent[], pattern: RegExp) {
  return flattenComponents(components).find(component => pattern.test(component.label));
}

function sameSources(first?: string[], second?: string[]) {
  const firstSources = first || [];
  const secondSources = second || [];
  return (
    firstSources.length === secondSources.length &&
    firstSources.every((source, index) => source === secondSources[index])
  );
}

function uniqueComputedId(baseId: string, computedValues: ComputedValueDefinition[]) {
  return uniqueId(baseId, new Set(computedValues.map(definition => definition.id)));
}

function uniqueComputedTarget(baseTarget: string, computedValues: ComputedValueDefinition[]) {
  return uniqueId(baseTarget, new Set(computedValues.map(definition => definition.target)));
}

function addPrefillMappings(
  form: AuthoringForm,
  mappings: Array<{ source: string; target?: string }>,
) {
  const validMappings = mappings.filter(
    (mapping): mapping is { source: string; target: string } => Boolean(mapping.target),
  );
  if (validMappings.length === 0) return form;

  const prefill = form.prefill || {};
  const existingMappings = prefill.mappings || [];
  const nextMappings = [...existingMappings];
  validMappings.forEach(mapping => {
    if (!nextMappings.some(item => item.source === mapping.source && item.target === mapping.target)) {
      nextMappings.push(mapping);
    }
  });

  return {
    ...form,
    prefill: {
      ...prefill,
      enabled: true,
      mappings: nextMappings,
    },
  };
}

function addComputedValue(
  form: AuthoringForm,
  definition: ComputedValueDefinition,
) {
  if (!definition.sources?.length) return form;
  const computedValues = form.computedValues || [];
  const existing = computedValues.some(
    item => item.operation === definition.operation && sameSources(item.sources, definition.sources),
  );
  if (existing) return form;

  return {
    ...form,
    computedValues: [
      ...computedValues,
      {
        ...definition,
        id: uniqueComputedId(definition.id, computedValues),
        target: uniqueComputedTarget(definition.target, computedValues),
      },
    ],
  };
}

export const previewTemplateAuthoringHelpers =
  previewTemplateAuthoringHelpersCore as (form: AuthoringForm) => TemplateHelperPreview[];

function addContactTemplateHelpers(form: AuthoringForm, components: AuthoringComponent[]) {
  const address = componentByType(components, 'address');
  const email = componentByType(components, 'email');
  const phone = componentByType(components, 'phone');
  const withPrefill = addPrefillMappings(form, [
    { source: 'profile.mailingAddress', target: address?.id },
    { source: 'profile.email', target: email?.id },
    { source: 'profile.phone', target: phone?.id },
  ]);
  const summarySources = [email?.id, phone?.id].filter(Boolean) as string[];
  return addComputedValue(withPrefill, {
    id: 'contactSummary',
    target: 'metadata.contactSummary',
    operation: 'concat',
    sources: summarySources,
    separator: ' | ',
  });
}

function addIdentityTemplateHelpers(form: AuthoringForm, components: AuthoringComponent[]) {
  const fullName = componentByLabel(components, /^Full name$/i);
  const dateOfBirth = componentByLabel(components, /date of birth/i);
  const ssn = componentByLabel(components, /social security number/i);
  const vaFileNumber = componentByLabel(components, /VA file number/i);
  const withPrefill = addPrefillMappings(form, [
    { source: 'profile.fullName', target: fullName?.id },
    { source: 'profile.dateOfBirth', target: dateOfBirth?.id },
    { source: 'profile.ssn', target: ssn?.id },
    { source: 'profile.vaFileNumber', target: vaFileNumber?.id },
  ]);
  const summarySources = [fullName?.id, dateOfBirth?.id].filter(Boolean) as string[];
  return addComputedValue(withPrefill, {
    id: 'identitySummary',
    target: 'metadata.identitySummary',
    operation: 'concat',
    sources: summarySources,
    separator: ' | ',
  });
}

function addTemplateAuthoringHelpers(
  form: AuthoringForm,
  templateId: SectionTemplateId | ScreenTemplateId,
  components: AuthoringComponent[],
  options: TemplateInsertionOptions = {},
) {
  if (options.includeAuthoringHelpers === false) return form;
  if (templateId === 'contact') return addContactTemplateHelpers(form, components);
  if (templateId === 'identity') return addIdentityTemplateHelpers(form, components);
  return form;
}

export const sectionTemplates = [
  {
    id: 'standard',
    label: 'Blank section',
    description: 'A blank content area on the current screen.',
  },
  {
    id: 'contact',
    label: 'Contact information',
    description: 'Current mailing address, email, and phone fields.',
  },
  {
    id: 'identity',
    label: 'Identity',
    description: 'Full name, date of birth, and optional SSN or VA file number fields.',
  },
  {
    id: 'claimantVeteran',
    label: 'Claimant/Veteran split',
    description: 'Claimant relationship flow with conditional Veteran details.',
  },
  {
    id: 'evidence',
    label: 'Evidence upload',
    description: 'Evidence yes/no question, conditional upload, and description fields.',
  },
  {
    id: 'certification',
    label: 'Certification',
    description: 'Certification checkbox, signature, and date signed fields.',
  },
  {
    id: 'yesNoDetails',
    label: 'Yes/no details',
    description: 'A yes/no question with a conditional details field.',
  },
  {
    id: 'repeatable',
    label: 'Repeating item group',
    description: 'Advanced pattern for lists like employers or dependents.',
  },
  {
    id: 'employmentLoop',
    label: 'Employment list',
    description: 'Repeatable employer details with start date, optional end date, and income.',
  },
  {
    id: 'dependentLoop',
    label: 'Dependent list',
    description: 'Repeatable dependent details with relationship and identity fields.',
  },
] satisfies Array<{ id: SectionTemplateId; label: string; description: string }>;

export const screenTemplates = [
  {
    id: 'blank',
    label: 'Blank screen',
    description: 'An empty screen ready for dragged fields.',
  },
] satisfies Array<{ id: ScreenTemplateId; label: string; description: string }>;

export function cloneForm(form: AuthoringForm): AuthoringForm {
  return JSON.parse(JSON.stringify(form)) as AuthoringForm;
}

export function findChapter(form: AuthoringForm, chapterId: string) {
  return form.chapters.find(chapter => chapter.id === chapterId);
}

export function findPage(form: AuthoringForm, selected: SelectedNode) {
  return findChapter(form, selected.chapterId)?.pages.find(page => page.id === selected.pageId);
}

export function findComponent(form: AuthoringForm, selected: SelectedNode) {
  return findComponentInList(findPage(form, selected)?.components || [], selected.componentId);
}

export function firstSelectableNode(form: AuthoringForm): SelectedNode {
  const chapter = form.chapters[0];
  const page = chapter?.pages[0];
  return {
    chapterId: chapter?.id || '',
    pageId: page?.id || '',
    componentId: page?.components[0]?.id,
  };
}

export type MoveDirection = 'up' | 'down';

function toId(value: string, fallback: string) {
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

function uniqueId(baseId: string, existingIds: Set<string>) {
  let id = baseId;
  let count = 2;

  while (existingIds.has(id)) {
    id = `${baseId}${count}`;
    count += 1;
  }

  return id;
}

function moveItem<T>(items: T[], index: number, direction: MoveDirection) {
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(nextIndex, 0, item);

  return nextItems;
}

function moveItemToIndex<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  const boundedIndex = Math.max(0, Math.min(toIndex, nextItems.length));
  nextItems.splice(boundedIndex, 0, item);
  return nextItems;
}

export function updateMetadata(
  form: AuthoringForm,
  patch: Partial<AuthoringForm>,
): AuthoringForm {
  return {
    ...form,
    ...patch,
  };
}

export function updatePage(
  form: AuthoringForm,
  selected: SelectedNode,
  updater: (page: AuthoringPage) => AuthoringPage,
): AuthoringForm {
  return {
    ...form,
    chapters: form.chapters.map(chapter => {
      if (chapter.id !== selected.chapterId) return chapter;
      return {
        ...chapter,
        pages: chapter.pages.map(page => (page.id === selected.pageId ? updater(page) : page)),
      };
    }),
  };
}

export function updateChapter(
  form: AuthoringForm,
  chapterId: string,
  updater: (chapter: AuthoringChapter) => AuthoringChapter,
): AuthoringForm {
  return {
    ...form,
    chapters: form.chapters.map(chapter => (chapter.id === chapterId ? updater(chapter) : chapter)),
  };
}

export function allChapterIds(form: AuthoringForm) {
  return new Set(form.chapters.map(chapter => chapter.id));
}

export function allPageIds(form: AuthoringForm) {
  return new Set(form.chapters.flatMap(chapter => chapter.pages.map(page => page.id)));
}

export function createPage(title: string, existingIds: Set<string>): AuthoringPage {
  const id = uniqueId(toId(title, 'newPage'), existingIds);
  return {
    id,
    title,
    components: [],
  };
}

function createComponentWithId(
  type: string,
  label: string,
  existingIds: Set<string>,
  options: Partial<AuthoringComponent> = {},
) {
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

export function createScreenFromTemplate(
  templateId: ScreenTemplateId,
  existingPageIds: Set<string>,
  existingComponentIds: Set<string>,
): AuthoringPage {
  const helperTemplateScreen = createHelperTemplateScreen(
    templateId,
    existingPageIds,
    existingComponentIds,
  ) as AuthoringPage | null;
  if (helperTemplateScreen) return helperTemplateScreen;

  if (templateId === 'claimantVeteran') {
    const claimantIsVeteranId = uniqueId('claimantIsVeteran', existingComponentIds);
    existingComponentIds.add(claimantIsVeteranId);
    const veteranOnlyRule: AuthoringRule = {
      field: claimantIsVeteranId,
      operator: 'equals',
      value: false,
    };
    return {
      id: uniqueId('claimantVeteranScreen', existingPageIds),
      title: 'Claimant and Veteran information',
      bodyText: 'Tell us whether you are applying for yourself or for someone else.',
      components: [
        {
          id: claimantIsVeteranId,
          type: 'yesNo',
          label: 'Are you the Veteran or service member?',
          hint: 'Answer no if you are applying as a claimant, dependent, or representative.',
          required: true,
        },
        createComponentWithId('select', 'Relationship to the Veteran', existingComponentIds, {
          showIf: veteranOnlyRule,
          requiredIf: veteranOnlyRule,
          responseOptions: [
            { value: 'spouse', label: 'Spouse' },
            { value: 'child', label: 'Child' },
            { value: 'parent', label: 'Parent' },
            { value: 'other', label: 'Other' },
          ],
          layoutWidth: 'half',
        }),
        createComponentWithId('textInput', "Veteran's full name", existingComponentIds, {
          showIf: veteranOnlyRule,
          requiredIf: veteranOnlyRule,
          autocomplete: 'name',
          summaryCard: true,
        }),
        createComponentWithId('memorableDate', "Veteran's date of birth", existingComponentIds, {
          showIf: veteranOnlyRule,
          requiredIf: veteranOnlyRule,
          hint: 'Enter the month, day, and year.',
          layoutWidth: 'half',
        }),
        createComponentWithId(
          'maskedInput',
          "Veteran's SSN or VA file number",
          existingComponentIds,
          {
            showIf: veteranOnlyRule,
            hint: 'Enter 8 or 9 digits with no dashes.',
            placeholder: '123456789',
            pattern: '^\\d{8,9}$',
            maxLength: 9,
            layoutWidth: 'half',
            errorMessages: {
              pattern: 'Enter 8 or 9 digits with no dashes.',
            },
          },
        ),
      ],
    };
  }

  if (templateId === 'evidence') {
    const hasEvidenceId = uniqueId('hasEvidence', existingComponentIds);
    existingComponentIds.add(hasEvidenceId);
    return {
      id: uniqueId('evidenceUpload', existingPageIds),
      title: 'Upload supporting evidence',
      bodyText: 'You can upload documents that support this application.',
      components: [
        {
          id: hasEvidenceId,
          type: 'yesNo',
          label: 'Do you want to upload supporting evidence?',
          required: true,
        },
        createComponentWithId('fileUpload', 'Upload supporting documents', existingComponentIds, {
          hint: 'Upload PDF, JPG, or PNG files. Maximum 10 MB per file.',
          showIf: {
            field: hasEvidenceId,
            operator: 'equals',
            value: true,
          },
          requiredIf: {
            field: hasEvidenceId,
            operator: 'equals',
            value: true,
          },
          multiple: true,
          accept: ['.pdf', '.jpg', '.jpeg', '.png'],
          maxFileCount: 5,
          maxFileSize: 10485760,
        }),
        createComponentWithId('characterCount', 'Describe the evidence', existingComponentIds, {
          hint: 'Tell us what this evidence shows.',
          showIf: {
            field: hasEvidenceId,
            operator: 'equals',
            value: true,
          },
          maxLength: 800,
        }),
      ],
    };
  }

  if (templateId === 'certification') {
    return {
      id: uniqueId('certificationScreen', existingPageIds),
      title: 'Certification and signature',
      bodyText: 'Review your answers before certifying and signing this application.',
      components: [
        createComponentWithId('checkbox', 'Certification', existingComponentIds, {
          required: true,
          responseOptions: [
            {
              value: 'certified',
              label: 'I certify that the information I provided is true and correct to the best of my knowledge and belief.',
            },
          ],
        }),
        createComponentWithId('textInput', 'Full name of person certifying', existingComponentIds, {
          required: true,
          autocomplete: 'name',
          layoutWidth: 'half',
        }),
        createComponentWithId('date', 'Date signed', existingComponentIds, {
          required: true,
          hint: 'Use the date you sign and submit this application.',
          layoutWidth: 'half',
        }),
      ],
    };
  }

  if (templateId === 'yesNoDetails') {
    const yesNoId = uniqueId('hasDetails', existingComponentIds);
    existingComponentIds.add(yesNoId);
    return {
      id: uniqueId('detailsScreen', existingPageIds),
      title: 'Additional details',
      bodyText: 'Answer the question below and provide details when needed.',
      components: [
        {
          id: yesNoId,
          type: 'yesNo',
          label: 'Do you need to provide more details?',
          required: true,
        },
        createComponentWithId('textArea', 'Tell us more', existingComponentIds, {
          showIf: {
            field: yesNoId,
            operator: 'equals',
            value: true,
          },
          requiredIf: {
            field: yesNoId,
            operator: 'equals',
            value: true,
          },
          maxLength: 500,
        }),
      ],
    };
  }

  return createPage('New screen', existingPageIds);
}

export function createChapter(
  type: AuthoringChapter['type'],
  existingChapterIds: Set<string>,
  existingPageIds: Set<string>,
): AuthoringChapter {
  const title = type === 'listLoop' ? 'New repeatable section' : 'New section';
  const id = uniqueId(toId(title, 'newChapter'), existingChapterIds);

  return {
    id,
    type,
    title,
    itemNameLabel: type === 'listLoop' ? 'Item name' : undefined,
    sectionIntro: type === 'listLoop' ? 'Add each item that applies.' : undefined,
    options:
      type === 'listLoop'
        ? {
            nounSingular: 'item',
            nounPlural: 'items',
            arrayPath: id,
            required: false,
            maxItems: 10,
          }
        : undefined,
    pages: [createPage(type === 'listLoop' ? 'Item details' : 'New screen', existingPageIds)],
  };
}

function createEmploymentLoopChapter(
  existingChapterIds: Set<string>,
  existingPageIds: Set<string>,
  existingComponentIds: Set<string>,
): AuthoringChapter {
  const id = uniqueId('employmentHistory', existingChapterIds);
  return {
    id,
    type: 'listLoop',
    title: 'Employment history',
    itemNameLabel: 'employerName',
    sectionIntro: 'Add each employer, business, or job that applies.',
    options: {
      nounSingular: 'employer',
      nounPlural: 'employers',
      arrayPath: 'employers',
      required: false,
      maxItems: 10,
    },
    pages: [
      {
        id: uniqueId('employmentDetails', existingPageIds),
        title: 'Employer details',
        components: [
          createComponentWithId('textInput', 'Employer name', existingComponentIds, {
            id: uniqueId('employerName', existingComponentIds),
            required: true,
            hint: 'Enter the employer or business name.',
            summaryCard: true,
          }),
          createComponentWithId('textInput', 'Job title', existingComponentIds, {
            id: uniqueId('jobTitle', existingComponentIds),
            layoutWidth: 'half',
          }),
          createComponentWithId('date', 'Date employment started', existingComponentIds, {
            id: uniqueId('employmentStartDate', existingComponentIds),
            required: true,
            layoutWidth: 'half',
          }),
          createComponentWithId('date', 'Date employment ended', existingComponentIds, {
            id: uniqueId('employmentEndDate', existingComponentIds),
            hint: 'Leave blank if this job is current.',
            layoutWidth: 'half',
          }),
          createComponentWithId('textInput', 'Average monthly income', existingComponentIds, {
            id: uniqueId('monthlyIncome', existingComponentIds),
            required: true,
            hint: 'Enter dollars only.',
            inputType: 'number',
            minimum: 0,
            layoutWidth: 'half',
            errorMessages: {
              minimum: 'Monthly income must be zero or more.',
            },
          }),
          createComponentWithId('address', 'Employer address', existingComponentIds),
          createComponentWithId('characterCount', 'Reason employment ended', existingComponentIds, {
            id: uniqueId('employmentEndReason', existingComponentIds),
            hint: 'Leave blank if this job is current.',
            maxLength: 500,
          }),
        ],
      },
    ],
  };
}

function createDependentLoopChapter(
  existingChapterIds: Set<string>,
  existingPageIds: Set<string>,
  existingComponentIds: Set<string>,
): AuthoringChapter {
  const id = uniqueId('dependents', existingChapterIds);
  return {
    id,
    type: 'listLoop',
    title: 'Dependents',
    itemNameLabel: 'dependentName',
    sectionIntro: 'Add each dependent you need to include.',
    options: {
      nounSingular: 'dependent',
      nounPlural: 'dependents',
      arrayPath: 'dependents',
      required: false,
      maxItems: 20,
    },
    pages: [
      {
        id: uniqueId('dependentDetails', existingPageIds),
        title: 'Dependent details',
        components: [
          createComponentWithId('textInput', "Dependent's full name", existingComponentIds, {
            id: uniqueId('dependentName', existingComponentIds),
            required: true,
            autocomplete: 'name',
            summaryCard: true,
          }),
          createComponentWithId('select', 'Relationship to you', existingComponentIds, {
            id: uniqueId('dependentRelationship', existingComponentIds),
            required: true,
            responseOptions: [
              { value: 'spouse', label: 'Spouse' },
              { value: 'child', label: 'Child' },
              { value: 'parent', label: 'Parent' },
              { value: 'other', label: 'Other' },
            ],
            layoutWidth: 'half',
          }),
          createComponentWithId('memorableDate', "Dependent's date of birth", existingComponentIds, {
            id: uniqueId('dependentDateOfBirth', existingComponentIds),
            required: true,
            hint: 'Enter the month, day, and year.',
            layoutWidth: 'half',
          }),
          createComponentWithId('maskedInput', "Dependent's SSN", existingComponentIds, {
            id: uniqueId('dependentSsn', existingComponentIds),
            hint: 'Enter 9 digits with no dashes if required for this application.',
            placeholder: '123456789',
            pattern: '^\\d{9}$',
            maxLength: 9,
            layoutWidth: 'half',
            errorMessages: {
              pattern: 'Enter 9 digits with no dashes.',
            },
          }),
        ],
      },
    ],
  };
}

export function createSectionFromTemplate(
  templateId: SectionTemplateId,
  existingChapterIds: Set<string>,
  existingPageIds: Set<string>,
  existingComponentIds: Set<string>,
): AuthoringChapter {
  if (templateId === 'repeatable') {
    return createChapter('listLoop', existingChapterIds, existingPageIds);
  }

  if (templateId === 'employmentLoop') {
    return createEmploymentLoopChapter(existingChapterIds, existingPageIds, existingComponentIds);
  }

  if (templateId === 'dependentLoop') {
    return createDependentLoopChapter(existingChapterIds, existingPageIds, existingComponentIds);
  }

  if (
    templateId === 'contact' ||
    templateId === 'identity' ||
    templateId === 'claimantVeteran' ||
    templateId === 'evidence' ||
    templateId === 'certification' ||
    templateId === 'yesNoDetails'
  ) {
    const id = uniqueId(`${templateId}Section`, existingChapterIds);
    const template = sectionTemplates.find(item => item.id === templateId);
    return {
      id,
      type: 'standard',
      title: template?.label || 'Reusable section',
      pages: [createScreenFromTemplate(templateId, existingPageIds, existingComponentIds)],
    };
  }

  return createChapter('standard', existingChapterIds, existingPageIds);
}

export function addChapter(
  form: AuthoringForm,
  type: AuthoringChapter['type'] = 'standard',
): { form: AuthoringForm; selected: SelectedNode } {
  const chapter = createChapter(type, allChapterIds(form), allPageIds(form));
  const nextForm = {
    ...form,
    chapters: [...form.chapters, chapter],
  };

  return {
    form: nextForm,
    selected: {
      chapterId: chapter.id,
      pageId: chapter.pages[0].id,
      componentId: undefined,
    },
  };
}

export function addSectionFromTemplate(
  form: AuthoringForm,
  templateId: SectionTemplateId,
  options: TemplateInsertionOptions = {},
): { form: AuthoringForm; selected: SelectedNode } {
  const chapter = createSectionFromTemplate(
    templateId,
    allChapterIds(form),
    allPageIds(form),
    allComponentIds(form),
  );
  const nextForm = addTemplateAuthoringHelpers({
    ...form,
    chapters: [...form.chapters, chapter],
  }, templateId, chapter.pages.flatMap(page => page.components), options);

  return {
    form: nextForm,
    selected: {
      chapterId: chapter.id,
      pageId: chapter.pages[0].id,
      componentId: chapter.pages[0].components[0]?.id,
    },
  };
}

export function addSectionTemplateToPage(
  form: AuthoringForm,
  selected: SelectedNode,
  templateId: SectionTemplateId,
  index = Number.MAX_SAFE_INTEGER,
  layoutWidth: LayoutWidth = 'full',
  options: TemplateInsertionOptions = {},
): { form: AuthoringForm; selected: SelectedNode } {
  if (
    templateId === 'repeatable' ||
    templateId === 'employmentLoop' ||
    templateId === 'dependentLoop'
  ) {
    return addSectionFromTemplate(form, templateId, options);
  }

  const currentSelection =
    selected.chapterId && selected.pageId
      ? { form, selected }
      : addSectionFromTemplate(form, 'standard');

  if (templateId === 'standard') {
    const existingIds = allComponentIds(currentSelection.form);
    const sectionId = uniqueId('blankSection', existingIds);
    const group: AuthoringComponent = {
      id: sectionId,
      type: 'sectionGroup',
      label: 'Blank section',
      description: 'Add fields or content to this section.',
      layoutWidth,
      children: [],
    };
    const nextForm = updatePage(currentSelection.form, currentSelection.selected, page => {
      const nextComponents = [...page.components];
      const insertAt = Math.max(0, Math.min(index, nextComponents.length));
      nextComponents.splice(insertAt, 0, group);
      return {
        ...page,
        components: nextComponents,
      };
    });
    return {
      form: nextForm,
      selected: {
        ...currentSelection.selected,
        componentId: sectionId,
      },
    };
  }

  const existingIds = allComponentIds(currentSelection.form);
  const templatePage = createScreenFromTemplate(
    templateId,
    allPageIds(currentSelection.form),
    existingIds,
  );
  const sectionId = uniqueId(`${templateId}Section`, existingIds);
  const template = sectionTemplates.find(item => item.id === templateId);
  const group: AuthoringComponent = {
    id: sectionId,
    type: 'sectionGroup',
    label: template?.label || 'Reusable section',
    description: template?.description,
    layoutWidth,
    children: templatePage.components,
  };
  const nextForm = updatePage(currentSelection.form, currentSelection.selected, page => {
    const nextComponents = [...page.components];
    const insertAt = Math.max(0, Math.min(index, nextComponents.length));
    nextComponents.splice(insertAt, 0, group);
    return {
      ...page,
      components: nextComponents,
    };
  });
  const withHelpers = addTemplateAuthoringHelpers(nextForm, templateId, group.children || [], options);

  return {
    form: withHelpers,
    selected: {
      ...currentSelection.selected,
      componentId: sectionId,
    },
  };
}

export function removeChapter(
  form: AuthoringForm,
  chapterId: string,
): { form: AuthoringForm; selected: SelectedNode } {
  const chapters = form.chapters.filter(chapter => chapter.id !== chapterId);
  const nextForm = { ...form, chapters };

  return {
    form: nextForm,
    selected: firstSelectableNode(nextForm),
  };
}

export function addPageToChapter(
  form: AuthoringForm,
  chapterId: string,
): { form: AuthoringForm; selected: SelectedNode } {
  const page = createPage('New screen', allPageIds(form));
  const nextForm = updateChapter(form, chapterId, chapter => ({
    ...chapter,
    pages: [...chapter.pages, page],
  }));

  return {
    form: nextForm,
    selected: {
      chapterId,
      pageId: page.id,
      componentId: undefined,
    },
  };
}

export function addScreenTemplateToChapter(
  form: AuthoringForm,
  chapterId: string,
  templateId: ScreenTemplateId,
  options: TemplateInsertionOptions = {},
): { form: AuthoringForm; selected: SelectedNode } {
  const page = createScreenFromTemplate(templateId, allPageIds(form), allComponentIds(form));
  const nextForm = updateChapter(form, chapterId, chapter => ({
    ...chapter,
    pages: [...chapter.pages, page],
  }));
  const withHelpers = addTemplateAuthoringHelpers(nextForm, templateId, page.components, options);

  return {
    form: withHelpers,
    selected: {
      chapterId,
      pageId: page.id,
      componentId: page.components[0]?.id,
    },
  };
}

export function addCustomScreenTemplateToChapter(
  form: AuthoringForm,
  chapterId: string,
  template: SavedCustomTemplate,
): { form: AuthoringForm; selected: SelectedNode } {
  if (template.kind !== 'screen' || !template.page) {
    return { form, selected: firstSelectableNode(form) };
  }

  const existingPageIds = allPageIds(form);
  const existingComponentIds = allComponentIds(form);
  const templatePage = JSON.parse(JSON.stringify(template.page)) as AuthoringPage;
  const page: AuthoringPage = {
    ...templatePage,
    id: uniqueId(toId(template.page.title, 'customScreen'), existingPageIds),
    path: undefined,
    components: instantiateCustomComponents(template.page.components || [], existingComponentIds),
  };
  const nextForm = updateChapter(form, chapterId, chapter => ({
    ...chapter,
    pages: [...chapter.pages, page],
  }));

  return {
    form: nextForm,
    selected: {
      chapterId,
      pageId: page.id,
      componentId: page.components[0]?.id,
    },
  };
}

export function addCustomSectionTemplateToPage(
  form: AuthoringForm,
  selected: SelectedNode,
  template: SavedCustomTemplate,
  index = Number.MAX_SAFE_INTEGER,
  layoutWidth: LayoutWidth = 'full',
): { form: AuthoringForm; selected: SelectedNode } {
  if (template.kind !== 'section' || !template.component) {
    return { form, selected };
  }

  const [component] = instantiateCustomComponents([template.component], allComponentIds(form));
  const section = {
    ...component,
    layoutWidth,
  };
  const nextForm = updatePage(form, selected, page => {
    const nextComponents = [...page.components];
    const insertAt = Math.max(0, Math.min(index, nextComponents.length));
    nextComponents.splice(insertAt, 0, section);
    return {
      ...page,
      components: nextComponents,
    };
  });

  return {
    form: nextForm,
    selected: {
      ...selected,
      componentId: section.id,
    },
  };
}

export function removePage(
  form: AuthoringForm,
  selected: SelectedNode,
): { form: AuthoringForm; selected: SelectedNode } {
  const chapter = findChapter(form, selected.chapterId);
  if (!chapter || chapter.pages.length <= 1) {
    return { form, selected };
  }

  const nextForm = updateChapter(form, selected.chapterId, currentChapter => ({
    ...currentChapter,
    pages: currentChapter.pages.filter(page => page.id !== selected.pageId),
  }));
  const nextChapter = findChapter(nextForm, selected.chapterId) || nextForm.chapters[0];
  const nextPage = nextChapter.pages[0];

  return {
    form: nextForm,
    selected: {
      chapterId: nextChapter.id,
      pageId: nextPage.id,
      componentId: nextPage.components[0]?.id,
    },
  };
}

export function moveChapter(
  form: AuthoringForm,
  chapterId: string,
  direction: MoveDirection,
): AuthoringForm {
  const index = form.chapters.findIndex(chapter => chapter.id === chapterId);
  return {
    ...form,
    chapters: moveItem(form.chapters, index, direction),
  };
}

export function moveChapterToIndex(
  form: AuthoringForm,
  chapterId: string,
  index: number,
): AuthoringForm {
  const fromIndex = form.chapters.findIndex(chapter => chapter.id === chapterId);
  return {
    ...form,
    chapters: moveItemToIndex(form.chapters, fromIndex, index),
  };
}

export function movePage(
  form: AuthoringForm,
  chapterId: string,
  pageId: string,
  direction: MoveDirection,
): AuthoringForm {
  return updateChapter(form, chapterId, chapter => {
    const index = chapter.pages.findIndex(page => page.id === pageId);
    return {
      ...chapter,
      pages: moveItem(chapter.pages, index, direction),
    };
  });
}

export function movePageToIndex(
  form: AuthoringForm,
  chapterId: string,
  pageId: string,
  index: number,
): AuthoringForm {
  return updateChapter(form, chapterId, chapter => {
    const fromIndex = chapter.pages.findIndex(page => page.id === pageId);
    return {
      ...chapter,
      pages: moveItemToIndex(chapter.pages, fromIndex, index),
    };
  });
}

export function moveComponent(
  form: AuthoringForm,
  selected: SelectedNode,
  direction: MoveDirection,
): AuthoringForm {
  return updatePage(form, selected, page => {
    const index = page.components.findIndex(component => component.id === selected.componentId);
    return {
      ...page,
      components: moveItem(page.components, index, direction),
    };
  });
}

export function updateComponent(
  form: AuthoringForm,
  selected: SelectedNode,
  updater: (component: AuthoringComponent) => AuthoringComponent,
): AuthoringForm {
  return updatePage(form, selected, page => ({
    ...page,
    components: updateComponentsRecursive(page.components, selected.componentId, updater),
  }));
}

export function createComponent(type: string, existingIds: Set<string>): AuthoringComponent {
  const baseId =
    type === 'textInput' ? 'newTextField' : `new${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  const id = uniqueId(baseId, existingIds);

  const component: AuthoringComponent = {
    id,
    type,
    label: paletteComponents.find(item => item.type === type)?.label || 'New field',
  };

  if (['radioButton', 'select', 'checkbox', 'comboBox'].includes(type)) {
    component.responseOptions = [
      { value: 'optionA', label: 'Option A' },
      { value: 'optionB', label: 'Option B' },
    ];
  }

  if (type === 'fileUpload') {
    component.multiple = true;
    component.accept = ['.pdf'];
    component.maxFileCount = 5;
    component.maxFileSize = 25;
  }

  if (type === 'phone') {
    component.inputType = 'tel';
    component.autocomplete = 'tel';
    component.placeholder = '(555) 555-5555';
    component.pattern = '^\\(\\d{3}\\) \\d{3}-\\d{4}$';
    component.maxLength = 14;
  }

  if (type === 'characterCount') {
    component.maxLength = 500;
    component.hint = 'You can enter up to 500 characters.';
  }

  if (type === 'dateRange') {
    component.startLabel = 'Start date';
    component.endLabel = 'End date';
    component.allowFutureDates = false;
  }

  if (type === 'inputGroup') {
    component.prefix = '$';
    component.inputType = 'number';
  }

  if (type === 'maskedInput') {
    component.placeholder = 'XXX-XX-XXXX';
    component.pattern = '^\\d{3}-\\d{2}-\\d{4}$';
    component.maxLength = 11;
    component.inputType = 'text';
    component.allowReveal = true;
  }

  if (type === 'rangeSlider') {
    component.minimum = 0;
    component.maximum = 100;
    component.step = 1;
  }

  if (type === 'alert') {
    component.alertType = 'info';
    component.description = 'Use this area for important information.';
  }

  if (type === 'summaryBox' || type === 'card' || type === 'accordion' || type === 'prose') {
    component.description = 'Add supporting content here.';
  }

  if (type === 'tag') {
    component.label = 'Status';
  }

  if (type === 'table') {
    component.headerRow = true;
    component.rows = [
      ['Label', 'Value'],
      ['Example', 'Details'],
    ];
  }

  if (type === 'processList') {
    component.items = ['Step one', 'Step two', 'Step three'];
  }

  if (type === 'buttonGroup') {
    component.primaryLabel = 'Primary action';
    component.secondaryLabel = 'Secondary action';
  }

  return component;
}

export function allComponentIds(form: AuthoringForm) {
  return new Set(
    form.chapters.flatMap(chapter =>
      chapter.pages.flatMap(page => flattenComponents(page.components).map(component => component.id)),
    ),
  );
}

export function allComponents(form: AuthoringForm) {
  return form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => flattenComponents(page.components)),
  );
}

export function addComponentToPage(
  form: AuthoringForm,
  selected: SelectedNode,
  type: string,
): { form: AuthoringForm; componentId: string } {
  const component = createComponent(type, allComponentIds(form));
  const nextForm = updatePage(form, selected, page => ({
    ...page,
    components: [...page.components, component],
  }));

  return { form: nextForm, componentId: component.id };
}

export function addComponentToPageAt(
  form: AuthoringForm,
  selected: SelectedNode,
  type: string,
  index = Number.MAX_SAFE_INTEGER,
  layoutWidth: LayoutWidth = 'full',
): { form: AuthoringForm; componentId: string } {
  const component = {
    ...createComponent(type, allComponentIds(form)),
    layoutWidth,
  };
  const nextForm = updatePage(form, selected, page => {
    const nextComponents = [...page.components];
    const insertAt = Math.max(0, Math.min(index, nextComponents.length));
    nextComponents.splice(insertAt, 0, component);

    return {
      ...page,
      components: nextComponents,
    };
  });

  return { form: nextForm, componentId: component.id };
}

export function moveComponentToPageAt(
  form: AuthoringForm,
  source: SelectedNode,
  target: SelectedNode,
  index = Number.MAX_SAFE_INTEGER,
  layoutWidth?: LayoutWidth,
): AuthoringForm {
  const sourcePage = findPage(form, source);
  const component = sourcePage?.components.find(item => item.id === source.componentId);
  if (!sourcePage || !component) return form;
  const movedComponent = layoutWidth ? { ...component, layoutWidth } : component;

  const samePage = source.chapterId === target.chapterId && source.pageId === target.pageId;
  const sourceIndex = sourcePage.components.findIndex(item => item.id === source.componentId);
  let insertAt = index;
  if (samePage && sourceIndex >= 0 && sourceIndex < index) {
    insertAt -= 1;
  }

  return {
    ...form,
    chapters: form.chapters.map(chapter => ({
      ...chapter,
      pages: chapter.pages.map(page => {
        const isSourcePage = chapter.id === source.chapterId && page.id === source.pageId;
        const isTargetPage = chapter.id === target.chapterId && page.id === target.pageId;
        let components = page.components;

        if (isSourcePage) {
          components = components.filter(item => item.id !== source.componentId);
        }

        if (isTargetPage) {
          const nextComponents = [...components];
          const boundedIndex = Math.max(0, Math.min(insertAt, nextComponents.length));
          nextComponents.splice(boundedIndex, 0, movedComponent);
          components = nextComponents;
        }

        return {
          ...page,
          components,
        };
      }),
    })),
  };
}

export function setComponentLayoutWidth(
  form: AuthoringForm,
  selected: SelectedNode,
  layoutWidth: LayoutWidth,
): AuthoringForm {
  return updateComponent(form, selected, component => ({
    ...component,
    layoutWidth,
  }));
}

export function setComponentRowStart(
  form: AuthoringForm,
  selected: SelectedNode,
  layoutNewRow: boolean,
): AuthoringForm {
  return updateComponent(form, selected, component => ({
    ...component,
    layoutNewRow,
  }));
}

export function duplicateComponent(
  form: AuthoringForm,
  selected: SelectedNode,
): { form: AuthoringForm; componentId?: string } {
  const sourcePage = findPage(form, selected);
  const component = findComponentInList(sourcePage?.components || [], selected.componentId);
  if (!sourcePage || !component) return { form, componentId: selected.componentId };

  const duplicateId = uniqueId(`${component.id}Copy`, allComponentIds(form));
  const duplicate = {
    ...(JSON.parse(JSON.stringify(component)) as AuthoringComponent),
    id: duplicateId,
    label: `${component.label} copy`,
  };
  const nextForm = updatePage(form, selected, page => {
    const result = duplicateComponentsRecursive(page.components, selected.componentId, duplicate);

    return {
      ...page,
      components: result.components,
    };
  });

  return { form: nextForm, componentId: duplicateId };
}

export function removeComponent(form: AuthoringForm, selected: SelectedNode): AuthoringForm {
  return updatePage(form, selected, page => ({
    ...page,
    components: removeComponentsRecursive(page.components, selected.componentId),
  }));
}
