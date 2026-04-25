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

test('static claim forms infer claim and insurance page structure', () => {
  const pages = segmentIntoPages([
    field('claimantName', 'Name and address of claimant', 0),
    field('dateOfAccident', 'Date and day of accident', 0),
    field('basisOfClaim', 'Basis of claim and property damage or personal injury', 0),
    field('insuranceCarrier', 'Name and address of insurance carrier', 1),
    field('policyNumber', 'Insurance company and policy number', 1),
    field('deductibleAmount', 'If deductible, state amount', 1),
  ]);
  const chapters = segmentIntoChapters(pages);

  assert.deepEqual(
    chapters.map(chapter => chapter.title),
    ['Claim information', 'Insurance information'],
  );
  assert.deepEqual(
    chapters.map(chapter => chapter.id),
    ['claimInformation1', 'insuranceInformation2'],
  );
});

test('correction board pages infer applicant information structure', () => {
  const pages = segmentIntoPages([
    field('changeReason', 'Why is a change requested?', 0),
    field('representativeOrganization', 'Organization', 0),
    field('representativeAddress', 'Mailing address street', 0),
    field('applicantSignature', 'Applicant must sign below', 0),
    field('electronicCorrespondence', 'Receive all correspondence electronically', 0),
  ]);

  assert.equal(pages[0].title, 'Applicant information');
  assert.equal(pages[0].semanticId, 'applicantInformation');
});

test('unemployability pages infer employment and education structure', () => {
  const pages = segmentIntoPages([
    field('employmentHistory', 'List all your employment including self-employment for the last five years you worked', 0),
    field('leftLastJob', 'Did you leave your last job or self-employment because of your disability?', 0),
    field('triedToObtainEmployment', 'Have you tried to obtain employment since you became too disabled to work?', 0),
    field('educationLevel', 'Education', 1),
    field('otherTrainingBeforeDisabled', 'Did you have any other education and training before you were too disabled to work?', 1),
    field('datesOfTraining', 'Dates of training', 1),
    field('typeOfTraining', 'Type of education or training', 1),
  ]);
  const chapters = segmentIntoChapters(pages);

  assert.deepEqual(
    chapters.map(chapter => chapter.title),
    ['Employment information', 'Education and training'],
  );
});

test('financial status pages infer financial information structure', () => {
  const pages = segmentIntoPages([
    field('cashInBank', 'Cash in bank checking and savings accounts', 0),
    field('stocksAndBonds', 'Stocks and other bonds', 0),
    field('realEstateOwned', 'Real estate owned', 0),
    field('installmentPayments', 'Monthly payments on installment contracts and other debts', 0),
    field('bankruptcy', 'Have you ever been adjudicated bankrupt?', 0),
    field('mortgageCompany', 'VA or a mortgage company was involved', 0),
    field('signature', 'Your signature', 0),
  ]);
  const chapters = segmentIntoChapters(pages);

  assert.equal(pages[0].title, 'Financial information');
  assert.equal(pages[0].semanticId, 'financialInformation');
  assert.equal(chapters[0].title, 'Financial information');
});

test('semantic pages with the same topic are grouped into one chapter', () => {
  const pages = segmentIntoPages([
    field('cashInBank', 'Cash in bank checking and savings accounts', 0),
    field('monthlyExpenses', 'Total monthly expenses and installment debts', 0),
    field('bankruptcy', 'Have you ever been adjudicated bankrupt?', 0),
    field('stocksAndBonds', 'Stocks and other bonds', 1),
    field('realEstateOwned', 'Real estate owned', 1),
    field('mortgageCompany', 'VA or a mortgage company was involved', 1),
  ]);
  const chapters = segmentIntoChapters(pages);

  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].title, 'Financial information');
  assert.equal(chapters[0].pages.length, 2);
});
