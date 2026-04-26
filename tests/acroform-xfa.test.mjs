import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractXfaFieldsFromHtml } from '../src/import/extract/acroform.mjs';

function textNode(value) {
  return { name: 'span', children: [{ value }] };
}

test('extractXfaFieldsFromHtml extracts fillable XFA fields with labels, options, and normalized bbox', () => {
  const xfaRoot = {
    name: 'div',
    children: [
      {
        name: 'div',
        attributes: {
          class: ['xfaPage'],
          id: 'pageArea1',
          style: { width: '600px', height: '800px' },
        },
        children: [
          {
            name: 'div',
            attributes: {
              class: ['xfaWrapper'],
              style: { top: '100px', left: '50px', width: '200px', height: '20px' },
            },
            children: [
              {
                name: 'div',
                attributes: {
                  class: ['xfaField'],
                  id: 'field1',
                  xfaName: 'VeteranName',
                },
                children: [
                  {
                    name: 'label',
                    attributes: { class: ['xfaLabel', 'xfaLeft'] },
                    children: [textNode('Veteran Name:')],
                  },
                  {
                    name: 'input',
                    attributes: {
                      class: ['xfaTextfield'],
                      type: 'text',
                      maxLength: '80',
                    },
                  },
                ],
              },
            ],
          },
          {
            name: 'div',
            attributes: {
              class: ['xfaWrapper'],
              style: { top: '140px', left: '50px', width: '120px', height: '18px' },
            },
            children: [
              {
                name: 'div',
                attributes: {
                  class: ['xfaField'],
                  id: 'field2',
                  xfaName: 'Urgent',
                },
                children: [
                  {
                    name: 'label',
                    attributes: { class: ['xfaLabel', 'xfaRight'] },
                    children: [textNode('Urgent')],
                  },
                  {
                    name: 'input',
                    attributes: {
                      class: ['xfaCheckbox'],
                      type: 'checkbox',
                    },
                  },
                ],
              },
            ],
          },
          {
            name: 'div',
            attributes: {
              class: ['xfaWrapper'],
              style: { top: '180px', left: '50px', width: '260px', height: '22px' },
            },
            children: [
              {
                name: 'div',
                attributes: {
                  class: ['xfaField'],
                  id: 'field3',
                  xfaName: 'CareType',
                },
                children: [
                  {
                    name: 'label',
                    attributes: { class: ['xfaLabel', 'xfaLeft'] },
                    children: [textNode('Type of care')],
                  },
                  {
                    name: 'select',
                    attributes: { class: ['xfaSelect'] },
                    children: [
                      { name: 'option', attributes: { value: 'Routine' }, children: [] },
                      { name: 'option', attributes: { value: 'Urgent' }, children: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const result = extractXfaFieldsFromHtml(xfaRoot);
  assert.equal(result.pageCount, 1);
  assert.equal(result.fields.length, 3);

  const [nameField, urgentField, careTypeField] = result.fields;
  assert.equal(nameField.type, 'text');
  assert.equal(nameField.name, 'VeteranName#field1');
  assert.equal(nameField.closestLabel, 'Veteran Name:');
  assert.equal(nameField.maxLength, 80);
  assert.ok(nameField.bbox);
  assert.equal(nameField.bbox.page, 0);
  assert.equal(Number(nameField.bbox.x.toFixed(3)), 0.083);
  assert.equal(Number(nameField.bbox.y.toFixed(3)), 0.125);
  assert.equal(Number(nameField.bbox.w.toFixed(3)), 0.333);
  assert.equal(Number(nameField.bbox.h.toFixed(3)), 0.025);

  assert.equal(urgentField.type, 'checkbox');
  assert.equal(urgentField.closestLabel, 'Urgent');

  assert.equal(careTypeField.type, 'dropdown');
  assert.deepEqual(careTypeField.options, ['Routine', 'Urgent']);
});

