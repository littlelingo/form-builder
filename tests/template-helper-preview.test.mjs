import assert from 'node:assert/strict';
import test from 'node:test';

import { previewTemplateAuthoringHelpers } from '../apps/builder/src/lib/templateHelperPreview.js';

function formWithComponents(components, extras = {}) {
  return {
    chapters: [
      {
        id: 'chapter',
        type: 'standard',
        title: 'Chapter',
        pages: [
          {
            id: 'page',
            title: 'Page',
            components,
          },
        ],
      },
    ],
    ...extras,
  };
}

function component(id, type = 'textInput', label = id) {
  return { id, type, label };
}

function previewByTemplate(form, templateId) {
  return previewTemplateAuthoringHelpers(form).find(preview => preview.templateId === templateId);
}

test('previews initial Contact and Identity helper target IDs', () => {
  const previews = previewTemplateAuthoringHelpers({ chapters: [] });
  const contact = previews.find(preview => preview.templateId === 'contact');
  const identity = previews.find(preview => preview.templateId === 'identity');

  assert.deepEqual(
    contact.prefill.map(mapping => [mapping.source, mapping.target]),
    [
      ['profile.mailingAddress', 'currentMailingAddress'],
      ['profile.email', 'emailAddress'],
      ['profile.phone', 'phoneNumber'],
    ],
  );
  assert.deepEqual(contact.computed, [
    {
      id: 'contactSummary',
      target: 'metadata.contactSummary',
      sources: ['emailAddress', 'phoneNumber'],
      sourceLabels: ['Email address', 'Phone number'],
    },
  ]);

  assert.deepEqual(
    identity.prefill.map(mapping => [mapping.source, mapping.target]),
    [
      ['profile.fullName', 'fullName'],
      ['profile.dateOfBirth', 'dateOfBirth'],
      ['profile.ssn', 'socialSecurityNumber'],
      ['profile.vaFileNumber', 'vaFileNumber'],
    ],
  );
  assert.deepEqual(identity.computed, [
    {
      id: 'identitySummary',
      target: 'metadata.identitySummary',
      sources: ['fullName', 'dateOfBirth'],
      sourceLabels: ['Full name', 'Date of birth'],
    },
  ]);
});

test('previews collision-safe helper IDs for Contact templates', () => {
  const form = formWithComponents([
    component('currentMailingAddress', 'address', 'Current mailing address'),
    component('emailAddress', 'email', 'Email address'),
    component('phoneNumber', 'phone', 'Phone number'),
  ], {
    computedValues: [
      {
        id: 'contactSummary',
        target: 'metadata.contactSummary',
        operation: 'concat',
        sources: ['emailAddress', 'phoneNumber'],
      },
    ],
  });

  const contact = previewByTemplate(form, 'contact');

  assert.deepEqual(
    contact.prefill.map(mapping => [mapping.source, mapping.target]),
    [
      ['profile.mailingAddress', 'currentMailingAddress2'],
      ['profile.email', 'emailAddress2'],
      ['profile.phone', 'phoneNumber2'],
    ],
  );
  assert.deepEqual(contact.computed, [
    {
      id: 'contactSummary2',
      target: 'metadata.contactSummary2',
      sources: ['emailAddress2', 'phoneNumber2'],
      sourceLabels: ['Email address', 'Phone number'],
    },
  ]);
});

test('previews collision-safe helper IDs for Identity templates', () => {
  const form = formWithComponents([
    component('fullName', 'textInput', 'Full name'),
    component('dateOfBirth', 'memorableDate', 'Date of birth'),
    component('socialSecurityNumber', 'maskedInput', 'Social Security number'),
    component('vaFileNumber', 'maskedInput', 'VA file number'),
  ], {
    computedValues: [
      {
        id: 'identitySummary',
        target: 'metadata.identitySummary',
        operation: 'concat',
        sources: ['fullName', 'dateOfBirth'],
      },
    ],
  });

  const identity = previewByTemplate(form, 'identity');

  assert.deepEqual(
    identity.prefill.map(mapping => [mapping.source, mapping.target]),
    [
      ['profile.fullName', 'fullName2'],
      ['profile.dateOfBirth', 'dateOfBirth2'],
      ['profile.ssn', 'socialSecurityNumber2'],
      ['profile.vaFileNumber', 'vaFileNumber2'],
    ],
  );
  assert.deepEqual(identity.computed, [
    {
      id: 'identitySummary2',
      target: 'metadata.identitySummary2',
      sources: ['fullName2', 'dateOfBirth2'],
      sourceLabels: ['Full name', 'Date of birth'],
    },
  ]);
});

test('omits helper preview entries that already exist for the generated targets', () => {
  const form = formWithComponents([
    component('currentMailingAddress', 'address', 'Current mailing address'),
    component('currentMailingAddress2', 'address', 'Current mailing address'),
    component('emailAddress', 'email', 'Email address'),
    component('emailAddress2', 'email', 'Email address'),
    component('phoneNumber', 'phone', 'Phone number'),
    component('phoneNumber2', 'phone', 'Phone number'),
  ], {
    prefill: {
      enabled: true,
      mappings: [
        { source: 'profile.email', target: 'emailAddress3' },
      ],
    },
    computedValues: [
      {
        id: 'contactSummary',
        target: 'metadata.contactSummary',
        operation: 'concat',
        sources: ['emailAddress3', 'phoneNumber3'],
      },
    ],
  });

  const contact = previewByTemplate(form, 'contact');

  assert.deepEqual(
    contact.prefill.map(mapping => [mapping.source, mapping.target]),
    [
      ['profile.mailingAddress', 'currentMailingAddress3'],
      ['profile.phone', 'phoneNumber3'],
    ],
  );
  assert.deepEqual(contact.computed, []);
});
