import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canonicalizeFormNumber, detectFormInventory } from '../src/import/inventory/forms.mjs';

test('canonicalizeFormNumber normalizes suffix and hyphen variants', () => {
  assert.equal(canonicalizeFormNumber('21-4142a'), '21-4142A');
  assert.equal(canonicalizeFormNumber('21P534a'), '21P-534A');
  assert.equal(canonicalizeFormNumber('VA FORM 10-10EZ'), '10-10EZ');
});

test('detectFormInventory identifies bundled form packet with page ranges', () => {
  const text = {
    pageCount: 5,
    pages: [
      {
        page: 0,
        items: [{ text: 'VA FORM 21-4142, AUG 2024', bbox: { y: 0.94 } }],
      },
      {
        page: 1,
        items: [{ text: 'VA FORM 21-4142, AUG 2024', bbox: { y: 0.94 } }],
      },
      {
        page: 2,
        items: [{ text: 'VA FORM 21-4142, AUG 2024', bbox: { y: 0.94 } }],
      },
      {
        page: 3,
        items: [{ text: 'VA FORM 21-4142a, AUG 2024', bbox: { y: 0.94 } }],
      },
      {
        page: 4,
        items: [{ text: 'VA FORM 21-4142a, AUG 2024', bbox: { y: 0.94 } }],
      },
    ],
  };

  const report = detectFormInventory(text, { filename: 'VBA-21-4142-ARE.pdf' });
  assert.equal(report.status, 'multi-form');
  assert.equal(report.detectedFormCount, 2);
  assert.deepEqual(
    report.forms.map(form => ({ number: form.formNumber, ranges: form.pageRanges, revisions: form.revisions })),
    [
      { number: '21-4142', ranges: ['1-3'], revisions: ['AUG 2024'] },
      { number: '21-4142A', ranges: ['4-5'], revisions: ['AUG 2024'] },
    ],
  );
  assert.equal(report.warnings.length, 1);
});
