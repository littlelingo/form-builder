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

test('consolidateFields handles XFA naming variants without mixing address and phone parts', () => {
  const fields = [
    {
      name: 'form1[0].#subform[0].DOBMonth[0]',
      type: 'text',
      closestLabel: '4. DATE OF BIRTH',
      neighborText: '4. DATE OF BIRTH (MM-DD-YYYY)',
      bbox: { page: 0, x: 0.6, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].DOBDay[0]',
      type: 'text',
      closestLabel: '(MM-DD-YYYY)',
      neighborText: '4. DATE OF BIRTH',
      bbox: { page: 0, x: 0.7, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].DOBYear[0]',
      type: 'text',
      closestLabel: '(MM-DD-YYYY)',
      neighborText: '4. DATE OF BIRTH',
      bbox: { page: 0, x: 0.8, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].FirstThreeNumbers[0]',
      type: 'text',
      closestLabel: '2. SOCIAL SECURITY NUMBER',
      neighborText: '2. SOCIAL SECURITY NUMBER',
      bbox: { page: 0, x: 0.1, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].SecondTwoNumbers[0]',
      type: 'text',
      closestLabel: '2. SOCIAL SECURITY NUMBER',
      neighborText: '2. SOCIAL SECURITY NUMBER',
      bbox: { page: 0, x: 0.2, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].LastFourNumbers[0]',
      type: 'text',
      closestLabel: 'unhelpful nearby address text',
      neighborText: 'nearby address text without SSN',
      bbox: { page: 0, x: 0.3, y: 0.1, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].CurrentMailingAddress_NumberAndStreet[0]',
      type: 'text',
      closestLabel: '5. MAILING ADDRESS',
      neighborText: '5. MAILING ADDRESS street',
      bbox: { page: 0, x: 0.1, y: 0.2, w: 0.4, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].CurrentMailingAddress_City[0]',
      type: 'text',
      closestLabel: 'City',
      neighborText: '5. MAILING ADDRESS city',
      bbox: { page: 0, x: 0.1, y: 0.23, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].CurrentMailingAddress_StateOrProvince[0]',
      type: 'text',
      closestLabel: 'State/Province',
      neighborText: '5. MAILING ADDRESS state',
      bbox: { page: 0, x: 0.2, y: 0.23, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].CurrentMailingAddress_ZIPOrPostalCode_LastFourNumbers[0]',
      type: 'text',
      closestLabel: 'ZIP Code/Postal Code',
      neighborText: 'ZIP Code/Postal Code Enter International Phone Number',
      bbox: { page: 0, x: 0.3, y: 0.23, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].NewAddress_NumberAndStreet[0]',
      type: 'text',
      closestLabel: '9. NEW ADDRESS',
      neighborText: '9. NEW ADDRESS street',
      bbox: { page: 0, x: 0.1, y: 0.4, w: 0.4, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].NewAddress_City[0]',
      type: 'text',
      closestLabel: 'City',
      neighborText: '9. NEW ADDRESS city',
      bbox: { page: 0, x: 0.1, y: 0.43, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].NewAddress_StateOrProvince[0]',
      type: 'text',
      closestLabel: 'State/Province',
      neighborText: '9. NEW ADDRESS state',
      bbox: { page: 0, x: 0.2, y: 0.43, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].NewAddress_ZIPOrPostalCode_FirstFiveNumbers[0]',
      type: 'text',
      closestLabel: 'ZIP Code/Postal Code',
      neighborText: '9. NEW ADDRESS ZIP',
      bbox: { page: 0, x: 0.3, y: 0.43, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].AreaCode[0]',
      type: 'text',
      closestLabel: '6. MAIN TELEPHONE NUMBER',
      neighborText: '6. MAIN TELEPHONE NUMBER',
      bbox: { page: 0, x: 0.1, y: 0.6, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].FirstThreeNumbers[1]',
      type: 'text',
      closestLabel: '6. MAIN TELEPHONE NUMBER',
      neighborText: '6. MAIN TELEPHONE NUMBER',
      bbox: { page: 0, x: 0.2, y: 0.6, w: 0.05, h: 0.02 },
    },
    {
      name: 'form1[0].#subform[0].LastFourNumbers[1]',
      type: 'text',
      closestLabel: '(Include Area Code)',
      neighborText: '6. MAIN TELEPHONE NUMBER',
      bbox: { page: 0, x: 0.3, y: 0.6, w: 0.05, h: 0.02 },
    },
  ];

  const consolidated = consolidateFields(fields);

  assert.equal(consolidated.length, 5);
  assert.equal(consolidated[0].closestLabel, '4. Date Of Birth');
  assert.equal(consolidated[1].closestLabel, '2. Social Security Number');
  assert.equal(consolidated[2].closestLabel, '5. Mailing Address');
  assert.equal(consolidated[3].closestLabel, '9. New Address');
  assert.equal(consolidated[4].closestLabel, '6. Main Telephone Number');
  assert.deepEqual(
    consolidated[2].sourceFieldNames,
    [
      'form1[0].#subform[0].CurrentMailingAddress_NumberAndStreet[0]',
      'form1[0].#subform[0].CurrentMailingAddress_City[0]',
      'form1[0].#subform[0].CurrentMailingAddress_StateOrProvince[0]',
      'form1[0].#subform[0].CurrentMailingAddress_ZIPOrPostalCode_LastFourNumbers[0]',
    ],
  );
});
