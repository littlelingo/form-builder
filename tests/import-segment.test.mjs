import assert from 'node:assert/strict';
import { test } from 'node:test';

import { segmentIntoChapters, segmentIntoPages } from '../src/import/heuristic/segment.mjs';

function field(name, closestLabel, page = 0) {
  return {
    name,
    closestLabel,
    bbox: { page, x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
  };
}

test('generic import segmentation infers semantic page titles from field context', () => {
  const pages = segmentIntoPages([
    field('VeteranFirstName', 'Veteran name'),
    field('VeteranSsn', 'Social Security number'),
    field('VeteranDateOfBirth', 'Date of birth'),
  ]);

  assert.equal(pages.length, 1);
  assert.equal(pages[0].title, 'Veteran information');
  assert.equal(pages[0].semanticId, 'veteranInformation');
});

test('semantic page titles become builder-style chapter structure for uncurated imports', () => {
  const pages = segmentIntoPages([
    field('VeteranEmail', 'Email address', 0),
    field('VeteranPhone', 'Phone number', 0),
    field('VeteranMailingAddress', 'Mailing address', 0),
    field('EmployerName', 'Employer name', 1),
    field('EmploymentDates', 'Dates of employment', 1),
  ]);
  const chapters = segmentIntoChapters(pages);

  assert.deepEqual(
    chapters.map(chapter => chapter.title),
    ['Contact information', 'Employment information'],
  );
  assert.deepEqual(
    chapters.map(chapter => chapter.pages[0].title),
    ['Details', 'Details'],
  );
  assert.deepEqual(
    chapters.map(chapter => chapter.pages[0].id),
    ['contactInformation1', 'employmentInformation2'],
  );
});
