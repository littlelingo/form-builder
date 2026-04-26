import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recognizeComponentPatterns } from '../src/import/pattern/recognize.mjs';

test('recognizeComponentPatterns annotates reusable granular roles and suggested component types', () => {
  const fields = [
    {
      name: 'group:ssn:VeteranSocialSecurityNumber',
      closestLabel: 'Social Security Number',
      neighborText: 'Enter Veteran SSN',
      type: 'text',
    },
    {
      name: 'group:date:DOBMonth+DOBDay+DOBYear',
      closestLabel: 'Date of Birth',
      neighborText: '(MM/DD/YYYY)',
      type: 'text',
    },
    {
      name: 'MailingAddress_NumberAndStreet',
      closestLabel: 'Mailing address',
      neighborText: 'City State ZIP Code',
      type: 'text',
    },
    {
      name: 'E_Mail_Address',
      closestLabel: 'E-Mail address',
      neighborText: 'Optional',
      type: 'text',
    },
    {
      name: 'TelephoneNumber_AreaCode',
      closestLabel: 'Telephone number',
      neighborText: 'Include area code',
      type: 'text',
    },
  ];

  const result = recognizeComponentPatterns(fields);
  assert.equal(result.report.totalFieldCount, 5);
  assert.equal(result.report.matchedFieldCount, 5);
  assert.ok(result.report.coverageRatio >= 0.9);
  assert.equal(result.report.mode, 'hybrid');
  assert.equal(result.report.sourceCounts?.deterministic, 5);

  const roles = result.fields.map(field => field.componentPattern?.role);
  assert.deepEqual(roles, ['ssn', 'dateOfBirth', 'address', 'email', 'phone']);

  assert.equal(result.fields[0].componentOverrides?.type, 'maskedInput');
  assert.equal(result.fields[1].componentOverrides?.type, 'date');
  assert.equal(result.fields[3].componentOverrides?.type, 'email');
});

test('recognizeComponentPatterns uses semantic fallback for unmatched fields in hybrid mode', () => {
  const fields = [
    {
      name: 'Field_1',
      closestLabel: 'General comments',
      neighborText: 'Provide any notes for context.',
      type: 'text',
    },
    {
      name: 'Field_2',
      closestLabel: 'Amount paid this month',
      neighborText: 'Enter dollars and cents.',
      type: 'text',
    },
  ];

  const hybrid = recognizeComponentPatterns(fields, { mode: 'hybrid' });
  assert.equal(hybrid.report.matchedFieldCount, 2);
  assert.ok((hybrid.report.sourceCounts?.semantic || 0) >= 1);
  assert.equal(hybrid.fields[0].componentPattern?.source, 'semantic');
  assert.equal(hybrid.fields[0].componentPattern?.role, 'textDetail');
  assert.ok(['currencyAmount', 'expenseAmount', 'incomeAmount'].includes(hybrid.fields[1].componentPattern?.role || ''));

  const deterministic = recognizeComponentPatterns(fields, { mode: 'deterministic' });
  assert.equal(deterministic.report.matchedFieldCount, 1);
  assert.equal(deterministic.fields[0].componentPattern, undefined);
  assert.equal(deterministic.fields[1].componentPattern?.source, 'deterministic');
});

test('recognizeComponentPatterns deterministic fallback handles date and binary prompts in static text', () => {
  const fields = [
    {
      name: 'static:dateAndDayOfAccident',
      closestLabel: 'Date And Day Of Accident',
      neighborText: '',
      type: 'text',
    },
    {
      name: 'static:isThisPersonDeceased',
      closestLabel: 'Is This Person Deceased?',
      neighborText: '',
      type: 'text',
      options: ['Yes', 'No'],
    },
  ];

  const deterministic = recognizeComponentPatterns(fields, { mode: 'deterministic' });
  assert.equal(deterministic.report.matchedFieldCount, 2);
  assert.equal(deterministic.fields[0].componentPattern?.role, 'incidentDate');
  assert.equal(deterministic.fields[1].componentPattern?.role, 'yesNo');
  assert.equal(deterministic.fields[0].componentPattern?.source, 'deterministic');
  assert.equal(deterministic.fields[1].componentPattern?.source, 'deterministic');
});

test('recognizeComponentPatterns deterministic fallback handles static item-number labels and dollar-only amounts', () => {
  const fields = [
    {
      name: 'static:22c',
      closestLabel: '22c',
      neighborText: '',
      type: 'text',
    },
    {
      name: 'F[0].P6[0].Section8_Q1[0]',
      closestLabel: '$',
      neighborText: '',
      type: 'text',
    },
  ];

  const deterministic = recognizeComponentPatterns(fields, { mode: 'deterministic' });
  assert.equal(deterministic.report.matchedFieldCount, 2);
  assert.equal(deterministic.fields[0].componentPattern?.role, 'numberValue');
  assert.equal(deterministic.fields[1].componentPattern?.role, 'currencyAmount');
  assert.equal(deterministic.fields[0].componentPattern?.source, 'deterministic');
  assert.equal(deterministic.fields[1].componentPattern?.source, 'deterministic');
});

test('recognizeComponentPatterns normalizes AcroForm/XFA scaffolding tokens into deterministic matches', () => {
  const fields = [
    {
      name: 'F[0].#subform[9].CurrentDisabilitys[0]',
      closestLabel: 'Current disability',
      neighborText: 'List each current disability condition.',
      type: 'text',
    },
    {
      name: 'F[0].Page_10[0].RadioButtonList2[0]',
      closestLabel: 'Have You Ever Filed A Claim With VA',
      neighborText: '',
      type: 'radio',
    },
    {
      name: 'F[0].P5[0].DateFrom1[0]',
      closestLabel: 'When did you serve in these locations?',
      neighborText: 'Date from month day year',
      type: 'text',
    },
  ];

  const deterministic = recognizeComponentPatterns(fields, { mode: 'deterministic' });
  assert.equal(deterministic.report.matchedFieldCount, 3);
  assert.equal(deterministic.fields[0].componentPattern?.role, 'disabilityCondition');
  assert.ok(['yesNo', 'radioChoice'].includes(deterministic.fields[1].componentPattern?.role || ''));
  assert.ok(['serviceDate', 'effectiveDate'].includes(deterministic.fields[2].componentPattern?.role || ''));
  assert.equal(deterministic.fields[0].componentPattern?.source, 'deterministic');
  assert.equal(deterministic.fields[1].componentPattern?.source, 'deterministic');
  assert.equal(deterministic.fields[2].componentPattern?.source, 'deterministic');
});

test('recognizeComponentPatterns matches enrollment/support count fields deterministically', () => {
  const fields = [
    {
      name: 'totalEnrolled12',
      closestLabel: 'ENROLLED',
      neighborText: 'TOTAL ENROLLED',
      type: 'text',
    },
    {
      name: 'supportedEnrolled7',
      closestLabel: 'ENROLLED',
      neighborText: 'SUPPORTED ENROLLED',
      type: 'text',
    },
    {
      name: 'numSupported3',
      closestLabel: 'ENROLLED',
      neighborText: 'NUMBER SUPPORTED',
      type: 'text',
    },
  ];

  const deterministic = recognizeComponentPatterns(fields, { mode: 'deterministic' });
  assert.equal(deterministic.report.matchedFieldCount, 3);
  assert.equal(deterministic.fields[0].componentPattern?.role, 'numberValue');
  assert.equal(deterministic.fields[1].componentPattern?.role, 'numberValue');
  assert.equal(deterministic.fields[2].componentPattern?.role, 'numberValue');
});
