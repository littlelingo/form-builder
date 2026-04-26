export type ComponentSystemId = 'uswds' | 'vaFormsSystem' | 'shadcn';

export type RuleOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'notExists'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

export interface AuthoringRule {
  all?: AuthoringRule[];
  any?: AuthoringRule[];
  not?: AuthoringRule;
  field?: string;
  operator?: RuleOperator;
  value?: unknown;
}

export interface ResponseOption {
  id?: string;
  value?: string;
  label: string;
  description?: string;
}

export interface ComponentValidation {
  message: string;
  rule: AuthoringRule;
}

export type ComputedValueOperation =
  | 'literal'
  | 'concat'
  | 'sum'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'coalesce'
  | 'mapValue'
  | 'booleanAny'
  | 'booleanAll';

export interface ComputedValueDefinition {
  id: string;
  target: string;
  operation: ComputedValueOperation;
  sources?: string[];
  value?: unknown;
  separator?: string;
  valueMap?: Record<string, unknown>;
  defaultValue?: unknown;
  condition?: AuthoringRule;
}

export type AuthoringEventName =
  | 'field.change'
  | 'field.focus'
  | 'field.blur'
  | 'page.enter'
  | 'form.submit'
  | 'form.beforeSubmit';

export type AuthoringActionType =
  | 'setValue'
  | 'setComponentProperty'
  | 'setVisibility'
  | 'setRequired'
  | 'setValidationMessage'
  | 'emitEvent';

export interface AuthoringEventAction {
  type: AuthoringActionType;
  target?: string;
  componentId?: string;
  property?: string;
  source?: string;
  value?: unknown;
  message?: string;
  event?: string;
  payload?: unknown;
  condition?: AuthoringRule;
}

export interface AuthoringEventHandler {
  id: string;
  event: AuthoringEventName;
  componentId?: string;
  condition?: AuthoringRule;
  actions: AuthoringEventAction[];
}

export type AuthoringSourceKind =
  | 'pdf'
  | 'normalizedForm'
  | 'manual'
  | 'scraped';

export interface AuthoringSource {
  kind: AuthoringSourceKind;
  uri?: string;
  hash?: string | null;
  importedAt?: string;
  importedBy?: string;
}

export interface AuthoringLineage {
  previousVersion: number | null;
  createdFromVersion: number | null;
  schemaHash: string;
}

export type AuthoringProvenanceOrigin =
  | 'pdf-field'
  | 'pdf-static-region'
  | 'template'
  | 'hand-authored';

export interface AuthoringProvenanceBbox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AuthoringCurationProvenance {
  source?: string;
  order?: number;
  chapterId?: string;
  chapterTitle?: string;
  chapterType?: string;
  chapterOptions?: Record<string, unknown>;
  itemNameLabel?: string;
  sectionIntro?: string;
  pageId?: string;
  pageTitle?: string;
  recipeId?: string | null;
  exemplarId?: string | null;
  similarity?: number;
}

export interface AuthoringConfidenceSignals {
  acroformSignal?: number;
  labelDistance?: number;
  classificationCertainty?: number;
  corpusSimilarity?: number;
  validationMatch?: number;
}

export interface AuthoringProvenance {
  origin: AuthoringProvenanceOrigin;
  pdfFieldName?: string;
  pdfPage?: number;
  bbox?: AuthoringProvenanceBbox;
  confidence: number;
  confidenceBand?: 'high' | 'medium' | 'low';
  signals?: AuthoringConfidenceSignals;
  reviewed: boolean;
  lastCorrectedBy?: string | null;
  exemplarId?: string | null;
  curation?: AuthoringCurationProvenance;
  componentPattern?: {
    role: string;
    family?: string;
    confidence: number;
    source?: 'deterministic' | 'semantic';
    evidence: string[];
    groupKey?: string;
    groupRole?: string;
  };
}

export interface AuthoringComponent {
  id: string;
  type: string;
  label: string;
  hint?: string;
  description?: string;
  required?: boolean;
  requiredIf?: AuthoringRule;
  showIf?: AuthoringRule;
  hideIf?: AuthoringRule;
  summaryCard?: boolean;
  responseOptions?: ResponseOption[];
  validations?: ComponentValidation[];
  errorMessages?: Record<string, string>;
  inputType?: string;
  autocomplete?: string;
  multiple?: boolean;
  accept?: string[];
  maxFileSize?: number;
  maxFileCount?: number;
  endpoint?: string;
  layoutWidth?: 'full' | 'half' | 'third';
  layoutNewRow?: boolean;
  children?: AuthoringComponent[];
  events?: AuthoringEventHandler[];
  provenance?: AuthoringProvenance;
  [key: string]: unknown;
}

export interface AuthoringPage {
  id: string;
  path?: string;
  title: string;
  bodyText?: string;
  condition?: AuthoringRule;
  components: AuthoringComponent[];
}

export interface AuthoringChapter {
  id: string;
  type?: 'standard' | 'listLoop';
  title: string;
  condition?: AuthoringRule;
  options?: {
    nounSingular?: string;
    nounPlural?: string;
    arrayPath?: string;
    required?: boolean;
    maxItems?: number;
  };
  itemNameLabel?: string;
  sectionIntro?: string;
  pages: AuthoringPage[];
}

export interface AuthoringForm {
  schemaVersion: string;
  formDefinitionVersion?: number;
  formId: string;
  title: string;
  plainLanguageHeader?: string;
  subTitle?: string;
  rootUrl?: string;
  trackingPrefix?: string;
  submitUrl?: string;
  version?: number;
  componentSystems?: {
    primary?: ComponentSystemId;
    generated?: ComponentSystemId;
    preview?: ComponentSystemId;
    additional?: ComponentSystemId[];
  };
  prefill?: {
    enabled?: boolean;
    mappings?: Array<{ source: string; target: string }>;
  };
  computedValues?: ComputedValueDefinition[];
  eventHandlers?: AuthoringEventHandler[];
  chapters: AuthoringChapter[];
  source?: AuthoringSource;
  lineage?: AuthoringLineage;
}

export interface SelectedNode {
  chapterId: string;
  pageId: string;
  componentId?: string;
}

export interface SavedCustomTemplate {
  id: string;
  kind: 'screen' | 'section';
  label: string;
  description?: string;
  createdAt: string;
  importedAt?: string;
  fieldCount?: number;
  page?: AuthoringPage;
  component?: AuthoringComponent;
}

export type SavedTemplateImportConflictStrategy = 'rename' | 'skip' | 'replace';

export interface SavedTemplateImportOptions {
  conflictStrategy?: SavedTemplateImportConflictStrategy;
}

export interface SavedTemplateImportResult {
  importedCount: number;
  renamedCount: number;
  replacedCount: number;
  skippedCount: number;
}

export interface PaletteComponent {
  type: string;
  label: string;
  description: string;
  category?: string;
  status?: 'supported' | 'previewOnly' | 'planned';
}

export type PaletteDragItem =
  | { kind: 'component'; type: string }
  | { kind: 'screen'; templateId: string; includeAuthoringHelpers?: boolean }
  | { kind: 'section'; templateId: string; includeAuthoringHelpers?: boolean }
  | { kind: 'customTemplate'; templateId: string };

export type PreviewData = Record<string, unknown>;
