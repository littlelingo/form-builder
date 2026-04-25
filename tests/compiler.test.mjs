import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  compileAuthoringForm,
  componentSystems,
  generateVaFormConfigModule,
  getComponentSystemSupport,
  validateAuthoringForm,
} from '../src/index.mjs';

function readExample(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const example = readExample('../examples/21-4140-authoring.json');
const careerGuidanceExample = readExample('../examples/27-8832-authoring.json');

test('validates and compiles the MVP authoring example', () => {
  const validation = validateAuthoringForm(example);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const compiled = compileAuthoringForm(example);
  assert.equal(compiled.metadata.prefillEnabled, true);
  assert.deepEqual(compiled.metadata.prefillMappings, [
    { source: 'profile.email', target: 'email' },
    { source: 'profile.phone', target: 'phone' },
  ]);
  assert.equal(compiled.metadata.componentSystems.primary, 'uswds');
  assert.equal(compiled.metadata.componentSystems.additional.includes('shadcn'), true);
  assert.equal(compiled.usesRules, true);
  assert.equal(compiled.usesComputedValues, true);
  assert.ok(compiled.imports.includes('arrayBuilderYesNoUI'));
  assert.ok(compiled.imports.includes('fileInputMultipleUI'));
  assert.ok(compiled.imports.includes('selectUI'));
});

test('generates VA formConfig code with list-loop, upload, validation, and computed-value support', () => {
  const generated = generateVaFormConfigModule(example);

  assert.match(generated, /arrayBuilderPages/);
  assert.match(generated, /fileInputMultipleUI/);
  assert.match(generated, /selectUI/);
  assert.match(generated, /evaluateAuthoringRule/);
  assert.match(generated, /applyAuthoringComputedValues/);
  assert.match(generated, /transformForSubmit/);
  assert.match(generated, /prefillEnabled: true/);
  assert.match(generated, /prefillTransformer/);
  assert.match(generated, /applyAuthoringPrefillMappings/);
  assert.match(generated, /source: "profile.email"/);
  assert.match(generated, /target: "email"/);
  assert.match(generated, /submitUrl: "\/v0\/form-21-4140"/);
});

test('validates and compiles the 27-8832 career guidance example', () => {
  const validation = validateAuthoringForm(careerGuidanceExample);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const compiled = compileAuthoringForm(careerGuidanceExample);
  assert.equal(compiled.metadata.formId, '27-8832');
  assert.equal(compiled.metadata.rootUrl, '/careers-employment/education-and-career-counseling/apply-career-guidance-form-27-8832');
  assert.equal(compiled.metadata.submitUrl, '/v0/form-27-8832');
  assert.equal(compiled.metadata.trackingPrefix, '27-8832-pcpg-');
  assert.equal(compiled.usesRules, true);
  assert.equal(compiled.usesComputedValues, false);
  assert.ok(compiled.imports.includes('textUI'));
  assert.ok(compiled.imports.includes('textareaUI'));
  assert.ok(compiled.imports.includes('radioUI'));
  assert.ok(compiled.imports.includes('checkboxGroupUI'));
  assert.ok(compiled.imports.includes('addressUI'));
  assert.ok(compiled.imports.includes('phoneUI'));
  assert.ok(compiled.imports.includes('emailUI'));
  assert.ok(compiled.imports.includes('yesNoUI'));
});

test('generates VA formConfig code for 27-8832 fields and conditional helpers', () => {
  const generated = generateVaFormConfigModule(careerGuidanceExample);

  assert.match(generated, /formId: "27-8832"/);
  assert.match(generated, /submitUrl: "\/v0\/form-27-8832"/);
  assert.match(generated, /textUI/);
  assert.match(generated, /textareaUI/);
  assert.match(generated, /radioUI/);
  assert.match(generated, /checkboxGroupUI/);
  assert.match(generated, /addressUI/);
  assert.match(generated, /phoneUI/);
  assert.match(generated, /emailUI/);
  assert.match(generated, /yesNoUI/);
  assert.match(generated, /evaluateAuthoringRule/);
  assert.match(generated, /formOptions: \{ enableChapterDepends: true \}/);
  assert.match(generated, /field: "applicantType"/);
  assert.match(generated, /field: "veteranAttendingSchool"/);
  assert.match(generated, /pattern: "\^\[0-9\]\{9\}\$"/);
});

test('generates VA output for promoted character count, masked input, date range, and memorable date controls', () => {
  const form = {
    ...careerGuidanceExample,
    chapters: [
      {
        id: 'promotedControls',
        title: 'Promoted controls',
        pages: [
          {
            id: 'promotedControlsPage',
            title: 'Promoted controls',
            components: [
              {
                id: 'remarksLimited',
                type: 'characterCount',
                label: 'Limited remarks',
                maxLength: 120,
              },
              {
                id: 'maskedSsn',
                type: 'maskedInput',
                label: 'Masked SSN',
                pattern: '^\\d{3}-\\d{2}-\\d{4}$',
                maxLength: 11,
                placeholder: 'XXX-XX-XXXX',
              },
              {
                id: 'birthDate',
                type: 'memorableDate',
                label: 'Birth date',
              },
              {
                id: 'servicePeriod',
                type: 'dateRange',
                label: 'Service period',
                startLabel: 'Service start date',
                endLabel: 'Service end date',
                required: true,
              },
              {
                id: 'projectedServicePeriod',
                type: 'dateRange',
                label: 'Projected service period',
                startLabel: 'Projected start date',
                endLabel: 'Projected end date',
                allowFutureDates: true,
              },
            ],
          },
        ],
      },
    ],
    computedValues: [],
    eventHandlers: [],
  };

  const validation = validateAuthoringForm(form);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const compiled = compileAuthoringForm(form);
  assert.equal(compiled.warnings.some(warning => warning.code === 'UNSUPPORTED_COMPONENT'), false);
  assert.ok(compiled.imports.includes('textareaUI'));
  assert.ok(compiled.imports.includes('textUI'));
  assert.ok(compiled.imports.includes('currentOrPastDateUI'));

  const generated = generateVaFormConfigModule(form);
  assert.match(generated, /remarksLimited: textareaUI/);
  assert.match(generated, /remarksLimited: \{ \.\.\.textareaSchema, maxLength: 120 \}/);
  assert.match(generated, /maskedSsn: textUI/);
  assert.match(generated, /pattern: "\^\\\\d\{3\}-\\\\d\{2\}-\\\\d\{4\}\$"/);
  assert.match(generated, /birthDate: currentOrPastDateUI/);
  assert.match(generated, /birthDate: currentOrPastDateSchema/);
  assert.match(generated, /servicePeriod: \{/);
  assert.match(generated, /startDate: currentOrPastDateUI/);
  assert.match(generated, /title: "Service start date"/);
  assert.match(generated, /endDate: currentOrPastDateUI/);
  assert.match(generated, /title: "Service end date"/);
  assert.match(generated, /required: \['startDate', 'endDate'\]/);
  assert.match(generated, /'ui:validations': \[/);
  assert.match(generated, /Enter an end date that is after the start date/);
  assert.match(generated, /projectedServicePeriod: \{/);
  assert.match(generated, /"ui:title": "Projected start date"/);
  assert.match(generated, /"ui:widget": "date"/);
  assert.match(generated, /"ui:title": "Projected end date"/);
});

test('generates VA output for promoted content blocks without answer fields', () => {
  const form = {
    ...careerGuidanceExample,
    chapters: [
      {
        id: 'contentBlocks',
        title: 'Content blocks',
        pages: [
          {
            id: 'contentBlocksPage',
            title: 'Content blocks',
            components: [
              {
                id: 'introCopy',
                type: 'prose',
                label: 'Before you start',
                description: 'Gather your records before continuing.',
              },
              {
                id: 'warningAlert',
                type: 'alert',
                label: 'Check your information',
                description: 'Incorrect information can delay processing.',
                alertType: 'warning',
                showIf: {
                  field: 'followUp',
                  operator: 'exists',
                },
              },
              {
                id: 'evidenceSummary',
                type: 'summaryBox',
                label: 'Evidence summary',
                description: 'Submit any records that support your request.',
              },
              {
                id: 'reviewTable',
                type: 'table',
                label: 'Document examples',
                rows: [
                  ['Document', 'Use'],
                  ['DD214', 'Service verification'],
                ],
              },
              {
                id: 'followUp',
                type: 'textInput',
                label: 'Follow-up answer',
                required: true,
              },
            ],
          },
        ],
      },
    ],
    computedValues: [],
    eventHandlers: [],
  };

  const validation = validateAuthoringForm(form);
  assert.equal(validation.valid, true, validation.errors.join('\n'));

  const compiled = compileAuthoringForm(form);
  assert.equal(compiled.warnings.some(warning => warning.code === 'UNSUPPORTED_COMPONENT'), false);
  assert.ok(compiled.imports.includes('titleSchema'));
  assert.deepEqual(compiled.chapters[0].pages[0].required, ['followUp']);

  const generated = generateVaFormConfigModule(form);
  assert.match(generated, /import React from 'react'/);
  assert.match(generated, /titleSchema/);
  assert.match(generated, /"view:introCopy": \{/);
  assert.match(generated, /"view:warningAlert": \{/);
  assert.match(generated, /className: "usa-alert usa-alert--warning"/);
  assert.match(generated, /'ui:options': \{\n\s+hideIf: formData => !evaluateAuthoringRule/);
  assert.match(generated, /field: "followUp"/);
  assert.match(generated, /"view:evidenceSummary": \{/);
  assert.match(generated, /className: "usa-summary-box"/);
  assert.match(generated, /"view:reviewTable": \{/);
  assert.match(generated, /className: "usa-table"/);
  assert.match(generated, /React\.createElement\("thead"/);
  assert.match(generated, /React\.createElement\("th", \{\n\s+key: "cell-0",\n\s+scope: "col"/);
  assert.match(generated, /required: \[\n\s+"followUp"/);
  assert.doesNotMatch(generated, /required: \[\n      "view:introCopy"/);
});

test('round trips the 27-8832 authoring JSON without losing key structure', () => {
  const serialized = JSON.stringify(careerGuidanceExample, null, 2);
  const parsed = JSON.parse(serialized);
  const validation = validateAuthoringForm(parsed);

  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.deepEqual(
    {
      schemaVersion: parsed.schemaVersion,
      formId: parsed.formId,
      title: parsed.title,
      rootUrl: parsed.rootUrl,
      submitUrl: parsed.submitUrl,
      chapterIds: parsed.chapters.map(chapter => chapter.id),
      pageIds: parsed.chapters.flatMap(chapter => chapter.pages.map(page => page.id)),
    },
    {
      schemaVersion: careerGuidanceExample.schemaVersion,
      formId: careerGuidanceExample.formId,
      title: careerGuidanceExample.title,
      rootUrl: careerGuidanceExample.rootUrl,
      submitUrl: careerGuidanceExample.submitUrl,
      chapterIds: careerGuidanceExample.chapters.map(chapter => chapter.id),
      pageIds: careerGuidanceExample.chapters.flatMap(chapter => chapter.pages.map(page => page.id)),
    },
  );
});

test('validates declarative event handlers', () => {
  const validation = validateAuthoringForm({
    ...example,
    eventHandlers: [
      {
        id: 'badHandler',
        event: 'field.changed',
        actions: [
          {
            type: 'setComponentProperty',
            componentId: 'missingField',
          },
        ],
      },
    ],
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /eventHandlers\[0\]\.event "field\.changed" is not supported/);
  assert.match(validation.errors.join('\n'), /eventHandlers\[0\]\.actions\[0\]\.componentId "missingField" does not match a component/);
  assert.match(validation.errors.join('\n'), /eventHandlers\[0\]\.actions\[0\]\.property is required/);
});

test('generates event runtime, event wrappers, and component metadata', () => {
  const form = {
    ...example,
    chapters: [
      ...example.chapters,
      {
        id: 'eventSection',
        title: 'Event section',
        pages: [
          {
            id: 'eventPage',
            title: 'Event page',
            components: [
              {
                id: 'contactGroup',
                type: 'sectionGroup',
                label: 'Contact group',
                children: [
                  {
                    id: 'nestedPhone',
                    type: 'phone',
                    label: 'Nested phone',
                    events: [
                      {
                        id: 'copyPhone',
                        event: 'field.change',
                        actions: [
                          {
                            type: 'setValue',
                            target: 'phoneCopy',
                            source: 'event.value',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'phoneCopy',
                    type: 'textInput',
                    label: 'Phone copy',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    eventHandlers: [
      {
        id: 'requireEmailBeforeSubmit',
        event: 'form.beforeSubmit',
        actions: [
          {
            type: 'setRequired',
            componentId: 'email',
            value: true,
          },
        ],
      },
    ],
  };

  const compiled = compileAuthoringForm(form);
  assert.equal(compiled.usesEvents, true);
  assert.equal(compiled.metadata.eventHandlers.length, 2);
  assert.equal(compiled.metadata.componentMetadataById.nestedPhone.type, 'phone');

  const generated = generateVaFormConfigModule(form);
  assert.match(generated, /export const authoringRuntime = createAuthoringRuntime/);
  assert.match(generated, /withAuthoringFieldEvents\("nestedPhone"/);
  assert.match(generated, /authoringRuntime\.emit\('form\.beforeSubmit'/);
  assert.match(generated, /authoringRuntime\.emit\('form\.submit'/);
  assert.match(generated, /componentId:\s*"nestedPhone"/);
  assert.match(generated, /target:\s*"phoneCopy"/);
});

test('validates declarative prefill mappings', () => {
  const validation = validateAuthoringForm({
    ...example,
    prefill: {
      enabled: true,
      mappings: [{ source: 'profile.email' }, { target: 'phone' }],
    },
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /prefill\.mappings\[0\]\.target is required/);
  assert.match(validation.errors.join('\n'), /prefill\.mappings\[1\]\.source is required/);
});

test('declares support for USWDS primary components and optional shadcn mappings', () => {
  assert.equal(componentSystems.uswds.components.fileUpload.component, 'File input');
  assert.equal(componentSystems.shadcn.components.textInput.component, 'Input');

  const support = getComponentSystemSupport('select');
  assert.equal(support.uswds.component, 'Select');
  assert.equal(support.shadcn.component, 'Select');
  assert.equal(support.vaFormsSystem.component, 'selectUI/selectSchema');
});
