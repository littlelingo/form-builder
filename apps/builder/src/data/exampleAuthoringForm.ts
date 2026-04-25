import employmentQuestionnaireExample from '../../../../examples/21-4140-authoring.json';
import careerGuidanceExample from '../../../../examples/27-8832-authoring.json';
import type { AuthoringForm } from '../types';

export interface BuilderExample {
  id: string;
  label: string;
  description: string;
  form: AuthoringForm;
}

export const builderExamples: BuilderExample[] = [
  {
    id: '21-4140',
    label: 'Employment Questionnaire (21-4140)',
    description: 'MVP example with prefill, evidence upload, list-loop, and computed values.',
    form: employmentQuestionnaireExample as AuthoringForm,
  },
  {
    id: '27-8832',
    label: 'Personalized Career Planning and Guidance (27-8832)',
    description: 'Chapter 36 application example with claimant conditions, contact, service, and certification screens.',
    form: careerGuidanceExample as AuthoringForm,
  },
];

export const exampleAuthoringForm = builderExamples[0].form;

export const blankAuthoringForm: AuthoringForm = {
  schemaVersion: '1.0.0',
  formDefinitionVersion: 1,
  formId: 'new-va-form',
  title: 'Untitled VA form',
  plainLanguageHeader: 'Untitled VA form',
  rootUrl: '/new-va-form',
  trackingPrefix: 'new-va-form-',
  submitUrl: '/v0/new-va-form',
  version: 0,
  componentSystems: {
    primary: 'uswds',
    generated: 'vaFormsSystem',
    preview: 'uswds',
    additional: ['shadcn'],
  },
  prefill: {
    enabled: false,
    mappings: [],
  },
  computedValues: [],
  chapters: [],
};
