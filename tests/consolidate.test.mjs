import assert from 'node:assert/strict';
import { test } from 'node:test';

import { consolidateFields } from '../src/import/heuristic/consolidate.mjs';

test('consolidateFields merges AcroForm radio widgets into one component candidate', () => {
  const fields = [
    {
      name: 'RadioButtonList[0]',
      type: 'radio',
      options: ['1', '2'],
      closestLabel: 'YES',
      neighborText: '20. ARE YOU CURRENTLY ATTENDING SCHOOL/TRAINING FACILITY? YES',
      bbox: { page: 0, x: 0.1, y: 0.2, w: 0.01, h: 0.01 },
    },
    {
      name: 'RadioButtonList[0]',
      type: 'radio',
      options: ['1', '2'],
      closestLabel: 'NO',
      neighborText: '20. ARE YOU CURRENTLY ATTENDING SCHOOL/TRAINING FACILITY? NO',
      bbox: { page: 0, x: 0.2, y: 0.2, w: 0.01, h: 0.01 },
    },
  ];

  const consolidated = consolidateFields(fields);

  assert.equal(consolidated.length, 1);
  assert.equal(consolidated[0].type, 'radio');
  assert.equal(consolidated[0].closestLabel, '20. Are You Currently Attending School/Training Facility');
  assert.deepEqual(consolidated[0].options, ['Yes', 'No']);
  assert.deepEqual(consolidated[0].sourceFieldNames, ['RadioButtonList[0]', 'RadioButtonList[0]']);
});

test('consolidateFields merges date, SSN, phone, and address fragments', () => {
  const fields = [
    {
      name: 'F[0].#subform[1].Month[0]',
      type: 'text',
      closestLabel: '3. DATE OF BIRTH',
      neighborText: '3. DATE OF BIRTH (MM-DD-YYYY)',
      bbox: { page: 0, x: 0.1, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].Day[0]',
      type: 'text',
      closestLabel: '(MM-DD-YYYY)',
      neighborText: '3. DATE OF BIRTH',
      bbox: { page: 0, x: 0.2, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].Year[0]',
      type: 'text',
      closestLabel: '(MM-DD-YYYY)',
      neighborText: '3. DATE OF BIRTH',
      bbox: { page: 0, x: 0.3, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].SSNFirstThreeNumbers[0]',
      type: 'text',
      closestLabel: '2. SOCIAL SECURITY NUMBER',
      neighborText: '2. SOCIAL SECURITY NUMBER (SSN)',
      bbox: { page: 0, x: 0.1, y: 0.2, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].SSNSecondTwoNumbers[0]',
      type: 'text',
      closestLabel: '(SSN)',
      neighborText: '2. SOCIAL SECURITY NUMBER',
      bbox: { page: 0, x: 0.2, y: 0.2, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].SSNLastFourNumbers[0]',
      type: 'text',
      closestLabel: '(SSN)',
      neighborText: '2. SOCIAL SECURITY NUMBER',
      bbox: { page: 0, x: 0.3, y: 0.2, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].AreaCode[0]',
      type: 'text',
      closestLabel: '6. TELEPHONE NUMBER',
      neighborText: '6. TELEPHONE NUMBER (Include Area Code)',
      bbox: { page: 0, x: 0.1, y: 0.3, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].FirstThreeNumbers[0]',
      type: 'text',
      closestLabel: '(Include Area Code)',
      neighborText: '6. TELEPHONE NUMBER',
      bbox: { page: 0, x: 0.2, y: 0.3, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].LastFourNumbers[0]',
      type: 'text',
      closestLabel: '(Include Area Code)',
      neighborText: '6. TELEPHONE NUMBER',
      bbox: { page: 0, x: 0.3, y: 0.3, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].Mailing_Address_City[0]',
      type: 'text',
      closestLabel: 'City',
      neighborText: '5. VETERAN MAILING ADDRESS City',
      bbox: { page: 0, x: 0.1, y: 0.4, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].Mailing_Address_StateOrProvince[0]',
      type: 'text',
      closestLabel: 'State/Province',
      neighborText: '5. VETERAN MAILING ADDRESS State',
      bbox: { page: 0, x: 0.2, y: 0.4, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].Mailing_Address_Country[0]',
      type: 'text',
      closestLabel: 'Country',
      neighborText: '5. VETERAN MAILING ADDRESS Country',
      bbox: { page: 0, x: 0.3, y: 0.4, w: 0.05, h: 0.02 },
    },
    {
      name: 'F[0].#subform[1].Mailing_Address_ZIPOrPostalCode_FirstFiveNumbers[0]',
      type: 'text',
      closestLabel: 'ZIP Code/Postal Code',
      neighborText: '5. VETERAN MAILING ADDRESS ZIP',
      bbox: { page: 0, x: 0.4, y: 0.4, w: 0.05, h: 0.02 },
    },
  ];

  const consolidated = consolidateFields(fields);

  assert.equal(consolidated.length, 4);
  assert.equal(consolidated[0].closestLabel, '3. Date Of Birth');
  assert.equal(consolidated[1].closestLabel, '2. Social Security Number');
  assert.equal(consolidated[2].closestLabel, '6. Telephone Number');
  assert.equal(consolidated[3].closestLabel, '5. Veteran Mailing Address');
});
