import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  appendListItem,
  buildReviewSections,
  buildSubmitPayload,
  buildVisibleSteps,
  listItemsForChapter,
  removeListItem,
  setFieldValueForStep,
  visibleComponentsForPage,
} from '../apps/builder/src/lib/runnerFlow.js';
import { emptyRuntimeState, executeRunnerEvent } from '../apps/builder/src/lib/runnerRuntime.js';
import { validateComponent, validateStep } from '../apps/builder/src/lib/runnerValidation.js';

const careerGuidanceExample = JSON.parse(
  readFileSync(new URL('../examples/27-8832-authoring.json', import.meta.url), 'utf8'),
);
const employmentExample = JSON.parse(
  readFileSync(new URL('../examples/21-4140-authoring.json', import.meta.url), 'utf8'),
);

test('builds visible 27-8832 standard step order and skips claimant chapters by default', () => {
  const { steps } = buildVisibleSteps(careerGuidanceExample, {}, emptyRuntimeState());

  assert.equal(steps[0].id, 'page:introductionAndEligibility:eligibilitySummary');
  assert.equal(steps.some(step => step.chapterId === 'claimantIdentity'), false);
  assert.equal(steps.some(step => step.chapterId === 'claimantContact'), false);
  assert.equal(steps.at(-1).id, 'review:form');
});

test('shows claimant chapters when applicantType is dependent claimant', () => {
  const { steps } = buildVisibleSteps(
    careerGuidanceExample,
    { applicantType: 'dependentClaimant' },
    emptyRuntimeState(),
  );

  assert.equal(steps.some(step => step.chapterId === 'claimantIdentity'), true);
  assert.equal(steps.some(step => step.chapterId === 'claimantContact'), true);
});

test('shows school name fields only when related yes/no answer is true', () => {
  const veteranSchoolPage = careerGuidanceExample.chapters
    .find(chapter => chapter.id === 'schoolTraining')
    .pages.find(page => page.id === 'veteranSchoolTrainingPage');

  assert.deepEqual(
    visibleComponentsForPage(veteranSchoolPage, { veteranAttendingSchool: false }, emptyRuntimeState()).map(
      component => component.id,
    ),
    ['veteranAttendingSchool'],
  );
  assert.deepEqual(
    visibleComponentsForPage(veteranSchoolPage, { veteranAttendingSchool: true }, emptyRuntimeState()).map(
      component => component.id,
    ),
    ['veteranAttendingSchool', 'veteranSchoolName'],
  );
});

test('keeps content-only components visible but out of validation, review, and submit payloads', () => {
  const page = {
    id: 'contentPage',
    title: 'Content page',
    components: [
      {
        id: 'hasEvidence',
        type: 'yesNo',
        label: 'Do you have evidence?',
        required: true,
      },
      {
        id: 'evidenceAlert',
        type: 'alert',
        label: 'Evidence reminder',
        required: true,
        showIf: {
          field: 'hasEvidence',
          operator: 'equals',
          value: true,
        },
      },
      {
        id: 'hiddenSummary',
        type: 'summaryBox',
        label: 'Hidden summary',
        hideIf: {
          field: 'hasEvidence',
          operator: 'equals',
          value: true,
        },
      },
    ],
  };
  const form = {
    ...careerGuidanceExample,
    chapters: [
      {
        id: 'contentChapter',
        title: 'Content chapter',
        pages: [page],
      },
    ],
  };

  assert.deepEqual(
    visibleComponentsForPage(page, { hasEvidence: true }, emptyRuntimeState()).map(component => component.id),
    ['hasEvidence', 'evidenceAlert'],
  );

  const { steps } = buildVisibleSteps(form, { hasEvidence: true }, emptyRuntimeState());
  const contentStep = steps.find(step => step.pageId === 'contentPage');
  assert.deepEqual(validateStep(contentStep, { hasEvidence: true }, emptyRuntimeState()), {});

  const review = buildReviewSections(
    form,
    {
      hasEvidence: true,
      evidenceAlert: 'stale content value',
      hiddenSummary: 'stale hidden content value',
    },
    emptyRuntimeState(),
  );
  assert.deepEqual(review.sections[0].pages[0].fields.map(field => field.id), ['hasEvidence']);

  const submit = buildSubmitPayload(
    form,
    {
      hasEvidence: true,
      evidenceAlert: 'stale content value',
      hiddenSummary: 'stale hidden content value',
    },
    emptyRuntimeState(),
  );
  assert.deepEqual(submit.payload, { hasEvidence: true });
  assert.equal(submit.trimmedFields.some(field => field.path === 'evidenceAlert'), false);
  assert.equal(submit.trimmedFields.some(field => field.path === 'hiddenSummary'), false);
});

test('validates required and pattern fields for SSN and VA file number', () => {
  const { steps } = buildVisibleSteps(careerGuidanceExample, {}, emptyRuntimeState());
  const identityStep = steps.find(step => step.pageId === 'veteranIdentityPage');
  const errors = validateStep(
    identityStep,
    {
      veteranFullName: 'Test Veteran',
      veteranSsn: 'abc',
      veteranDateOfBirth: '1980-01-01',
      veteranVaFileNumber: '123',
    },
    emptyRuntimeState(),
  );

  assert.match(errors.veteranSsn.join('\n'), /required format/);
  assert.match(errors.veteranVaFileNumber.join('\n'), /required format/);
});

test('uses authored validation messages for required and common constraints', () => {
  const { steps } = buildVisibleSteps(careerGuidanceExample, {}, emptyRuntimeState());
  const identityStep = structuredClone(steps.find(step => step.pageId === 'veteranIdentityPage'));
  const ssn = identityStep.page.components.find(component => component.id === 'veteranSsn');
  ssn.required = true;
  ssn.pattern = '^\\d{9}$';
  ssn.minLength = 9;
  ssn.errorMessages = {
    required: 'Enter a Social Security number.',
    pattern: 'Use 9 digits with no dashes.',
    minLength: 'Use all 9 digits.',
  };

  const missingErrors = validateStep(identityStep, {}, emptyRuntimeState());
  assert.equal(missingErrors.veteranSsn[0], 'Enter a Social Security number.');

  const patternErrors = validateStep(identityStep, { veteranSsn: '123' }, emptyRuntimeState());
  assert.match(patternErrors.veteranSsn.join('\n'), /Use 9 digits with no dashes/);
  assert.match(patternErrors.veteranSsn.join('\n'), /Use all 9 digits/);
});

test('validates date ranges for order and optional future dates', () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateRange = {
    id: 'servicePeriod',
    type: 'dateRange',
    label: 'Service period',
  };

  const defaultErrors = validateComponent(
    dateRange,
    { startDate: tomorrow, endDate: tomorrow },
    {},
    emptyRuntimeState(),
  );
  assert.match(defaultErrors.join('\n'), /today or in the past/);

  const futureAllowedErrors = validateComponent(
    { ...dateRange, allowFutureDates: true },
    { startDate: tomorrow, endDate: tomorrow },
    {},
    emptyRuntimeState(),
  );
  assert.deepEqual(futureAllowedErrors, []);

  const orderErrors = validateComponent(
    { ...dateRange, allowFutureDates: true },
    { startDate: '2026-04-25', endDate: '2026-04-24' },
    {},
    emptyRuntimeState(),
  );
  assert.match(orderErrors.join('\n'), /after the start date/);
});

test('executes event actions and records event log entries', () => {
  const eventForm = {
    ...employmentExample,
    eventHandlers: [
      {
        id: 'copyEmail',
        event: 'field.change',
        componentId: 'email',
        actions: [{ type: 'setValue', target: 'emailCopy', source: 'event.value' }],
      },
      {
        id: 'requirePhone',
        event: 'field.change',
        componentId: 'email',
        actions: [{ type: 'setRequired', componentId: 'phone', value: true }],
      },
    ],
  };
  const result = executeRunnerEvent({
    form: eventForm,
    data: { email: 'veteran@example.com' },
    runtimeState: emptyRuntimeState(),
    eventLog: [],
    eventName: 'field.change',
    payload: { componentId: 'email', value: 'veteran@example.com' },
  });

  assert.equal(result.data.emailCopy, 'veteran@example.com');
  assert.equal(result.runtimeState.components.phone.required, true);
  assert.equal(result.eventLog.some(entry => entry.handlerId === 'copyEmail'), true);
});

test('builds, edits, validates, and removes list-loop data for 21-4140 employment history', () => {
  const chapter = employmentExample.chapters.find(item => item.id === 'employmentHistory');
  const added = appendListItem({}, chapter);
  const activeListItem = { chapterId: chapter.id, itemIndex: added.itemIndex };
  const withItemSteps = buildVisibleSteps(employmentExample, added.data, emptyRuntimeState(), activeListItem).steps;
  const firstItemStep = withItemSteps.find(step => step.kind === 'listItemPage' && step.pageId === 'employerDetails');

  let data = setFieldValueForStep(added.data, firstItemStep, 'employerName', 'Acme Co');
  data = setFieldValueForStep(data, firstItemStep, 'employmentType', 'fullTime');
  const missingIncomeErrors = validateStep(firstItemStep, data, emptyRuntimeState());
  assert.match(missingIncomeErrors['employmentHistory.0.monthlyIncome'].join('\n'), /required/);

  data = setFieldValueForStep(data, firstItemStep, 'monthlyIncome', 2500);
  assert.deepEqual(validateStep(firstItemStep, data, emptyRuntimeState()), {});
  assert.equal(listItemsForChapter(data, chapter)[0].employerName, 'Acme Co');

  const removed = removeListItem(data, chapter, 0);
  assert.equal(listItemsForChapter(removed, chapter).length, 0);
});

test('builds review sections with standard pages and list-loop items', () => {
  const chapter = employmentExample.chapters.find(item => item.id === 'employmentHistory');
  const data = {
    email: 'veteran@example.com',
    phone: '5551234567',
    hasEvidence: false,
    employmentHistory: [
      {
        employerName: 'Acme Co',
        employmentType: 'fullTime',
        monthlyIncome: 2500,
        startDate: '2024-01-01',
      },
    ],
  };
  const { sections, computedData } = buildReviewSections(employmentExample, data, emptyRuntimeState());
  const contact = sections.find(section => section.id === 'contactInformation');
  const employment = sections.find(section => section.id === chapter.id);

  assert.equal(computedData.metadata.contactSummary, 'veteran@example.com | 5551234567');
  assert.equal(contact.pages[0].fields.find(field => field.id === 'email').displayValue, 'veteran@example.com');
  assert.equal(employment.items[0].label, 'Acme Co');
  assert.match(employment.items[0].summary, /Average monthly income: 2500/);
});

test('submit payload trims hidden answered fields and reports computed values', () => {
  const careerSubmit = buildSubmitPayload(
    careerGuidanceExample,
    {
      applicantType: 'veteranOrServiceMember',
      veteranAttendingSchool: false,
      veteranSchoolName: 'Hidden school',
    },
    emptyRuntimeState(),
  );

  assert.equal(careerSubmit.payload.veteranSchoolName, undefined);
  assert.equal(
    careerSubmit.trimmedFields.some(field => field.path === 'veteranSchoolName'),
    true,
  );

  const employmentSubmit = buildSubmitPayload(
    employmentExample,
    { email: 'veteran@example.com', phone: '5551234567', hasEvidence: false },
    emptyRuntimeState(),
  );

  assert.equal(employmentSubmit.computedData.metadata.contactSummary, 'veteran@example.com | 5551234567');
  assert.equal(
    employmentSubmit.computedValues.some(item => item.target === 'metadata.contactSummary'),
    true,
  );
});
