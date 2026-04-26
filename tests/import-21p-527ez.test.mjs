import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { assessImportQuality, qualitySignals } from '../src/cli/import-corpus.mjs';
import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const FORM_21P_527EZ_FIXTURE = new URL('../../form-samples/VBA-21P-527EZ-ARE.pdf', import.meta.url);

async function fixtureAvailable(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

function allComponents(form) {
  return form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
}

test('VBA 21P-527EZ imports as a curated Veterans Pension workflow', async t => {
  if (!(await fixtureAvailable(FORM_21P_527EZ_FIXTURE))) {
    t.skip('VBA 21P-527EZ sample fixture not present');
    return;
  }

  const bytes = await readFile(FORM_21P_527EZ_FIXTURE);
  const { form, importReport } = await importPdf(bytes, {
    filename: 'VBA-21P-527EZ-ARE.pdf',
    enrich: false,
  });
  const validation = validateAuthoringForm(form);
  const components = allComponents(form);
  const labels = components.map(component => component.label);
  const signals = qualitySignals(form, importReport);
  const quality = assessImportQuality({
    status: 'ok',
    componentCount: importReport.componentCount,
    validation: importReport.validation,
    curation: importReport.curation,
    qualitySignals: signals,
  });

  assert.equal(importReport.acroFormFieldCount, 519);
  assert.equal(importReport.componentCount, 346);
  assert.equal(importReport.formInventory?.status, 'multi-form');
  assert.ok(
    (importReport.formInventory?.forms || []).some(form => form.formNumber === '21P-527EZ'),
  );
  assert.ok(
    (importReport.formInventory?.forms || []).some(form => form.formNumber === '21P-8416'),
  );
  assert.ok((importReport.patterns?.coverageRatio || 0) >= 0.45);
  assert.ok((importReport.patterns?.roleCounts?.provider || 0) >= 20);
  assert.ok((importReport.patterns?.roleCounts?.address || 0) >= 20);
  assert.equal(importReport.curation.status, 'curated');
  assert.equal(
    importReport.curation.recipe.recipeId,
    'va-form-21p-527ez-veterans-pension-2023-acroform',
  );
  assert.equal(importReport.curation.recipe.matchedFieldCount, 491);
  assert.equal(importReport.curation.curatedFieldCount, 491);
  assert.deepEqual(
    importReport.curation.decisions.map(decision => ({
      type: decision.type,
      chapterId: decision.chapterId,
      arrayPath: decision.arrayPath,
      sourceFieldCount: decision.sourceFieldCount,
      itemFieldCount: decision.itemFieldCount,
      estimatedItemCount: decision.estimatedItemCount,
    })),
    [
      {
        type: 'listLoop',
        chapterId: 'dependentChildEntries',
        arrayPath: 'dependentChildren',
        sourceFieldCount: 45,
        itemFieldCount: 15,
        estimatedItemCount: 3,
      },
      {
        type: 'listLoop',
        chapterId: 'incomeSources',
        arrayPath: 'incomeSources',
        sourceFieldCount: 32,
        itemFieldCount: 8,
        estimatedItemCount: 4,
      },
      {
        type: 'listLoop',
        chapterId: 'careProviderExpenses',
        arrayPath: 'careProviderExpenses',
        sourceFieldCount: 54,
        itemFieldCount: 18,
        estimatedItemCount: 3,
      },
      {
        type: 'listLoop',
        chapterId: 'medicalExpenses',
        arrayPath: 'medicalExpenses',
        sourceFieldCount: 66,
        itemFieldCount: 11,
        estimatedItemCount: 6,
      },
    ],
  );
  assert.equal(importReport.validation.valid, true, importReport.validation.errors.join('\n'));
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(quality.level, 'curated');
  assert.deepEqual(signals.veryLongLabels, []);
  assert.deepEqual(signals.duplicateLabels, []);
  assert.equal(signals.needsReview, false);

  assert.deepEqual(
    form.chapters.map(chapter => chapter.title),
    [
      'Evidence checklist',
      'Veteran identity',
      'Veteran contact information',
      'Military service',
      'Pension information',
      'Employment history',
      'Marital status and spouse information',
      'Prior marital history',
      'Dependent children',
      'Dependent child entries',
      'Income and assets',
      'Income sources',
      'Unreimbursed medical expenses',
      'Care provider expenses',
      'Medical expenses',
      'Direct deposit information',
      'Certification and signature',
      'Alternate signer',
      'Care facility worksheet',
      'In-home care worksheet',
    ],
  );

  const byId = id => components.find(component => component.id === id);
  assert.equal(byId('veteranFullName')?.type, 'textInput');
  assert.equal(byId('veteranSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('spouseSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('childSocialSecurityNumber')?.type, 'maskedInput');
  assert.equal(byId('assetsOver25000Dollars')?.type, 'radioButton');
  assert.equal(byId('careProviderTypeOfCare')?.type, 'radioButton');
  assert.equal(byId('medicalExpenseAmountPaidCents')?.type, 'textInput');
  assert.equal(byId('financialInstitutionName')?.type, 'textInput');
  assert.equal(byId('claimantSignatureDate')?.type, 'date');
  assert.equal(byId('alternateSignerSignatureDate')?.type, 'date');
  assert.equal(byId('careFacilityProviderSignatureDate')?.type, 'date');
  assert.equal(byId('inHomeCareProviderSignatureDate')?.type, 'date');

  assert.deepEqual(
    byId('careProviderTypeOfCare')?.responseOptions?.map(option => option.label),
    ['Care facility', 'In-home care attendant'],
  );
  assert.deepEqual(
    byId('incomeSourceType')?.responseOptions?.map(option => option.label),
    ['Social Security', 'Interest or dividends', 'Civil service', 'Pension or retirement', 'Other'],
  );
  assert.deepEqual(
    byId('directDepositAccountType')?.responseOptions?.map(option => option.label),
    ['Checking', 'Savings', 'No financial institution account'],
  );

  assert.ok(labels.includes('Veteran full name'));
  assert.ok(labels.includes('Claiming special monthly pension'));
  assert.ok(labels.includes('Number of dependent children living with Veteran'));
  assert.ok(labels.includes('Child first name'));
  assert.ok(labels.includes('Child Social Security number'));
  assert.ok(labels.includes('Care provider name and type of care'));
  assert.ok(labels.includes('Type of care'));
  assert.ok(labels.includes('Hours worked per week'));
  assert.ok(labels.includes('Income source payer name'));
  assert.ok(labels.includes('Income source current gross monthly income amount'));
  assert.ok(labels.includes('Medical expense paid to'));
  assert.ok(labels.includes('Medical expense amount paid amount'));
  assert.ok(labels.includes('Care facility state or country requires licensing'));
  assert.ok(labels.includes('In-home care hours per month'));

  const dependentChildEntries = form.chapters.find(chapter => chapter.id === 'dependentChildEntries');
  assert.equal(dependentChildEntries?.type, 'listLoop');
  assert.deepEqual(dependentChildEntries?.options, {
    nounSingular: 'child',
    nounPlural: 'children',
    arrayPath: 'dependentChildren',
    required: false,
    maxItems: 10,
  });
  assert.equal(dependentChildEntries?.itemNameLabel, 'Child first name');
  assert.equal(dependentChildEntries?.sectionIntro, 'Add each dependent child listed on the source form.');
  assert.deepEqual(
    dependentChildEntries?.pages[0].components.map(component => component.id),
    [
      'childFirstName',
      'childMiddleInitial',
      'childLastName',
      'childBirthDateMonth',
      'childBirthDateDay',
      'childBirthDateYear',
      'childSocialSecurityNumber',
      'childPlaceOfBirth',
      'childBiologicalChild',
      'childStepchild',
      'childSeriouslyDisabled',
      'childEighteenToTwentyThreeInSchool',
      'childPreviouslyMarried',
      'childAdopted',
      'childDoesNotLiveWithVeteranButContributes',
    ],
  );
  assert.equal(dependentChildEntries?.pages[0].components[0].summaryCard, true);

  const incomeSources = form.chapters.find(chapter => chapter.id === 'incomeSources');
  assert.equal(incomeSources?.type, 'listLoop');
  assert.deepEqual(incomeSources?.options, {
    nounSingular: 'income source',
    nounPlural: 'income sources',
    arrayPath: 'incomeSources',
    required: false,
    maxItems: 10,
  });
  assert.equal(incomeSources?.itemNameLabel, 'Income payer name');
  assert.equal(incomeSources?.sectionIntro, 'Add each income source listed on the source form.');
  assert.deepEqual(
    incomeSources?.pages[0].components.map(component => component.id),
    [
      'incomeSourcePayerName',
      'incomeSourceRecipient',
      'incomeSourceType',
      'incomeSourceChildRecipientName',
      'incomeSourceCurrentGrossMonthlyIncomeDollars',
      'incomeSourceCurrentGrossMonthlyIncomeCents',
      'incomeSourceCurrentGrossMonthlyIncomeAmount',
      'incomeSourceOtherIncomeType',
    ],
  );
  assert.equal(incomeSources?.pages[0].components[0].summaryCard, true);

  const careProviderExpenses = form.chapters.find(chapter => chapter.id === 'careProviderExpenses');
  assert.equal(careProviderExpenses?.type, 'listLoop');
  assert.deepEqual(careProviderExpenses?.options, {
    nounSingular: 'provider',
    nounPlural: 'providers',
    arrayPath: 'careProviderExpenses',
    required: false,
    maxItems: 10,
  });
  assert.equal(careProviderExpenses?.itemNameLabel, 'Care provider name and type of care');
  assert.equal(careProviderExpenses?.sectionIntro, 'Add each care provider listed on the source form.');
  assert.deepEqual(
    careProviderExpenses?.pages[0].components.map(component => component.id),
    [
      'careProviderNameAndTypeOfCare',
      'careProviderExpenseRecipient',
      'careProviderHourlyRateDollars',
      'careProviderHourlyRateCents',
      'careProviderHoursWorkedPerWeek',
      'careProviderChildRecipientName',
      'careProviderTypeOfCare',
      'careProviderStartDateMonth',
      'careProviderStartDateDay',
      'careProviderStartDateYear',
      'careProviderPaymentFrequency',
      'careProviderAmountPaidDollars',
      'careProviderAmountPaidCents',
      'careProviderAmountPaidAmount',
      'careProviderEndDateMonth',
      'careProviderEndDateDay',
      'careProviderEndDateYear',
      'careProviderNoEndDate',
    ],
  );
  assert.equal(careProviderExpenses?.pages[0].components[0].summaryCard, true);

  const medicalExpenses = form.chapters.find(chapter => chapter.id === 'medicalExpenses');
  assert.equal(medicalExpenses?.type, 'listLoop');
  assert.deepEqual(medicalExpenses?.options, {
    nounSingular: 'medical expense',
    nounPlural: 'medical expenses',
    arrayPath: 'medicalExpenses',
    required: false,
    maxItems: 10,
  });
  assert.equal(medicalExpenses?.itemNameLabel, 'Medical expense paid to');
  assert.equal(medicalExpenses?.sectionIntro, 'Add each medical expense listed on the source form.');
  assert.deepEqual(
    medicalExpenses?.pages[0].components.map(component => component.id),
    [
      'medicalExpensePaidTo',
      'medicalExpenseDateCostsPaidMonth',
      'medicalExpenseDateCostsPaidDay',
      'medicalExpenseDateCostsPaidYear',
      'medicalExpenseRecipient',
      'medicalExpensePaymentFrequency',
      'medicalExpensePurpose',
      'medicalExpenseChildRecipientName',
      'medicalExpenseAmountPaidDollars',
      'medicalExpenseAmountPaidCents',
      'medicalExpenseAmountPaidAmount',
    ],
  );
  assert.equal(medicalExpenses?.pages[0].components[0].summaryCard, true);
});
