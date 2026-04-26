import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from 'playwright';

const port = Number(process.env.BUILDER_SMOKE_PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const repoRoot = new URL('..', import.meta.url);
const pensionPdfFixture = new URL('../../form-samples/VBA-21P-527EZ-ARE.pdf', import.meta.url);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function startDevServer() {
  const server = spawn(
    npmCommand,
    [
      '--workspace',
      '@va/form-builder-ui',
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        BROWSER: 'none',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const output = [];
  server.stdout.on('data', chunk => output.push(String(chunk)));
  server.stderr.on('data', chunk => output.push(String(chunk)));

  return {
    process: server,
    output,
    async stop() {
      if (server.exitCode !== null || server.signalCode !== null) return;
      server.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => server.once('exit', resolve)),
        delay(3000).then(() => {
          if (server.exitCode === null && server.signalCode === null) {
            server.kill('SIGKILL');
          }
        }),
      ]);
    },
  };
}

async function waitForServer(server) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30000) {
    if (server.process.exitCode !== null) {
      throw new Error(`Builder dev server exited early:\n${server.output.join('')}`);
    }

    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for builder dev server at ${baseUrl}: ${lastError?.message || 'no response'}\n${server.output.join('')}`,
  );
}

async function metric(page, label) {
  const metrics = await page.locator('[aria-label="Current form summary"] > div').allTextContents();
  const match = metrics.find(item => item.toLowerCase().includes(label.toLowerCase()));
  assert.ok(match, `Expected a "${label}" metric in ${JSON.stringify(metrics)}`);
  const value = match.match(/\d+|Yes|No/)?.[0];
  assert.ok(value, `Expected a value for "${label}" metric`);
  return value;
}

async function expectMetric(page, label, expected) {
  assert.equal(await metric(page, label), String(expected));
}

async function expectVisible(page, locator, message) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  assert.ok(await locator.isVisible(), message);
}

async function checkLabeledControl(page, label) {
  const control =
    typeof label === 'string'
      ? page.getByLabel(label, { exact: true })
      : page.getByLabel(label);
  const visibleLabel =
    typeof label === 'string'
      ? page.getByLabel('Form workspace').getByText(label, { exact: true })
      : page.getByLabel('Form workspace').getByText(label);
  await visibleLabel.click();
  assert.equal(await control.isChecked(), true, `Expected "${String(label)}" to be checked.`);
}

async function authoringForm(page) {
  await page.getByRole('tab', { name: 'Code' }).click();
  const authoringJson = await page
    .locator('.builder-output__panel')
    .first()
    .locator('pre')
    .textContent();
  return JSON.parse(authoringJson || '{}');
}

function savedTemplateImportInput(page) {
  return page.getByRole('region', { name: 'Add to canvas' }).locator('input[type="file"]');
}

function collectComponentIds(components = []) {
  return components.flatMap(component => [
    component.id,
    ...collectComponentIds(component.children || []),
  ]);
}

function flattenComponents(form) {
  return form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(screen => screen.components),
  );
}

function trackBrowserErrors(page) {
  const browserErrors = [];
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon.ico')) return;
    browserErrors.push(text);
  });
  page.on('pageerror', error => browserErrors.push(error.message));
  return browserErrors;
}

async function loadBlankBuilder(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Start building' }),
    'Expected the blank builder canvas to load.',
  );
}

async function smokeCuratedPdfImport(page) {
  try {
    await access(pensionPdfFixture);
  } catch {
    console.warn(`Skipping curated PDF import smoke; fixture not found at ${pensionPdfFixture.pathname}`);
    return;
  }

  await loadBlankBuilder(page);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import PDF' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(pensionPdfFixture.pathname);
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Multiple forms detected' }),
    'Expected multi-form imports to show an in-app confirmation dialog.',
  );
  await page.getByRole('button', { name: 'Continue import' }).click();

  await expectVisible(
    page,
    page.getByRole('heading', { name: 'PDF import loaded into the canvas' }),
    'Expected fully curated PDF import to load into the canvas.',
  );
  await expectMetric(page, 'Sections', 20);
  await expectMetric(page, 'Fields', 346);
  await expectVisible(
    page,
    page.getByText('Recipe curation matched all 491 source fields'),
    'Expected fully recipe-curated imports to report complete recipe coverage.',
  );
  await expectVisible(
    page,
    page.getByText('curated 491/491'),
    'Expected import progress to show full curation coverage.',
  );
  await expectVisible(
    page,
    page.getByText('45 source fields converted into 15 loop fields across about 3 children'),
    'Expected dependent child list-loop curation decision in progress panel.',
  );
  await expectVisible(
    page,
    page.getByText('32 source fields converted into 8 loop fields across about 4 income sources'),
    'Expected income source list-loop curation decision in progress panel.',
  );
  await expectVisible(
    page,
    page.getByText('54 source fields converted into 18 loop fields across about 3 providers'),
    'Expected care provider list-loop curation decision in progress panel.',
  );
  await expectVisible(
    page,
    page.getByText('66 source fields converted into 11 loop fields across about 6 medical expenses'),
    'Expected medical expense list-loop curation decision in progress panel.',
  );
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Screens' }),
    'Expected imported form outline to be populated.',
  );
  await expectVisible(
    page,
    page.getByRole('button', { name: /^Dependent child entries\b/ }).first(),
    'Expected imported outline to include curated list-loop chapter.',
  );
  await expectVisible(
    page,
    page.getByLabel('Form workspace').getByRole('heading', { name: 'Supporting forms and evidence' }),
    'Expected imported form canvas to be populated.',
  );
  assert.equal(
    await page.getByRole('dialog', { name: /Step \d+ of \d+/ }).count(),
    0,
    'Expected fully recipe-curated imports not to open the low-confidence review wizard.',
  );

  await page.getByRole('tab', { name: 'Review' }).click();
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Imported components (0)' }),
    'Expected fully recipe-curated imports to have no required human review rows.',
  );
  await expectVisible(
    page,
    page.getByText('All imported components reviewed.'),
    'Expected Review panel to state that all imported components are reviewed.',
  );
  await expectVisible(
    page,
    page.getByText('Converted by recipe into a list loop with 15 fields at dependentChildren.'),
    'Expected Review panel to explain dependent child curation decision.',
  );
  await expectVisible(
    page,
    page.getByText('Converted by recipe into a list loop with 11 fields at medicalExpenses.'),
    'Expected Review panel to explain medical expense curation decision.',
  );
}

async function smokeBasicAuthoringAndRunner(page) {
  await page.getByRole('button', { name: 'Add Text input' }).click();
  await expectMetric(page, 'Sections', 1);
  await expectMetric(page, 'Fields', 1);

  await page.getByRole('tab', { name: 'Run' }).click();
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'New screen' }),
    'Expected the runner to open on the generated screen.',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Submit this mock form' }),
    'Expected runner review and submit to render.',
  );
  await page.getByRole('button', { name: 'Submit' }).click();
  await expectVisible(
    page,
    page.getByLabel('Submit this mock form').getByText('Mock submitted'),
    'Expected mock submit to complete successfully.',
  );

  await page.getByRole('tab', { name: 'Code' }).click();
  await expectVisible(page, page.getByText('Valid'), 'Expected generated output to be valid.');
  const generatedCode = await page
    .locator('.builder-output__panel')
    .nth(1)
    .locator('pre')
    .textContent();
  assert.match(generatedCode || '', /const formConfig = \{/);
}

async function openPatterns(page) {
  await page.getByRole('tab', { name: 'Canvas' }).click();
  await page.getByRole('tab', { name: 'Patterns' }).click();
}

async function smokeHelperPresetReview(page) {
  await openPatterns(page);
  await expectVisible(
    page,
    page.getByRole('checkbox', { name: 'Include helper presets' }),
    'Expected template helper preset control to render.',
  );
  assert.equal(
    await page.getByRole('checkbox', { name: 'Include helper presets' }).isChecked(),
    true,
    'Expected template helper presets to be included by default.',
  );
  await page.getByText('Review helper presets').click();
  await expectVisible(
    page,
    page.getByText('profile.email -> emailAddress (Email address)'),
    'Expected helper preset review to show Contact prefill targets with generated IDs.',
  );
  await expectVisible(
    page,
    page.getByText('identitySummary writes metadata.identitySummary from fullName + dateOfBirth'),
    'Expected helper preset review to show Identity computed targets with generated IDs.',
  );
}

async function smokeSavedTemplateLibrary(page) {
  await page.getByRole('button', { name: 'Add Contact information' }).click();
  await expectMetric(page, 'Fields', 2);
  await expectVisible(
    page,
    page.getByText('profile.email -> emailAddress2 (Email address)'),
    'Expected helper preset review to preview collision-safe Contact target IDs.',
  );
  await expectVisible(
    page,
    page.getByText('contactSummary2 writes metadata.contactSummary2 from emailAddress2 + phoneNumber2'),
    'Expected helper preset review to preview collision-safe Contact computed targets.',
  );

  await page.getByLabel('Template name').fill('Smoke saved contact');
  await page.getByRole('button', { name: 'Save section' }).click();
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Saved templates' }),
    'Expected saved templates group to appear.',
  );
  await expectVisible(page, page.getByText(/Section .* 3 fields .* Created/), 'Expected saved template metadata.');
  await page.getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Rename saved template').fill('Smoke renamed contact');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expectVisible(
    page,
    page.getByRole('button', { name: 'Add Smoke renamed contact' }),
    'Expected renamed saved template to be available for insertion.',
  );

  await page
    .getByRole('button', { name: 'Add Smoke renamed contact' })
    .dragTo(page.getByLabel('Drop at end'));
  await expectMetric(page, 'Fields', 3);

  const parsed = await authoringForm(page);
  const componentIds = parsed.chapters.flatMap(chapter =>
    chapter.pages.flatMap(screen => collectComponentIds(screen.components)),
  );
  assert.equal(new Set(componentIds).size, componentIds.length, 'Expected unique component IDs.');
  assert.equal(parsed.prefill?.enabled, true, 'Expected template helpers to enable prefill.');
  assert.ok(
    parsed.prefill?.mappings?.some(mapping => mapping.source === 'profile.email' && mapping.target === 'emailAddress'),
    'Expected contact template email prefill mapping.',
  );
  assert.ok(
    parsed.prefill?.mappings?.some(mapping => mapping.source === 'profile.phone' && mapping.target === 'phoneNumber'),
    'Expected contact template phone prefill mapping.',
  );
  assert.ok(
    parsed.computedValues?.some(
      definition =>
        definition.id === 'contactSummary' &&
        definition.target === 'metadata.contactSummary' &&
        definition.sources?.includes('emailAddress') &&
        definition.sources?.includes('phoneNumber'),
    ),
    'Expected contact template computed summary.',
  );

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'va-form-builder-saved-templates.json');
  const exportedTemplatePath = await download.path();
  assert.ok(exportedTemplatePath, 'Expected exported saved-template file path.');

  await savedTemplateImportInput(page).setInputFiles(exportedTemplatePath);
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Review import conflicts' }),
    'Expected saved template import conflicts to require review.',
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    'saved-template-import-review-heading',
    'Expected saved template import review heading to receive focus.',
  );
  await expectVisible(
    page,
    page.getByText('Incoming: Section'),
    'Expected saved template import review to show incoming template metadata.',
  );
  await expectVisible(
    page,
    page.getByText('Existing: Section'),
    'Expected saved template import review to show existing template metadata.',
  );
  await expectVisible(
    page,
    page.getByRole('button', { name: 'Rename duplicates' }),
    'Expected saved template import review to offer duplicate renaming.',
  );
  await expectVisible(
    page,
    page.getByRole('button', { name: 'Skip duplicates' }),
    'Expected saved template import review to offer duplicate skipping.',
  );
  await expectVisible(
    page,
    page.getByRole('button', { name: 'Replace existing' }),
    'Expected saved template import review to offer replacement.',
  );
  await page.getByRole('button', { name: 'Rename duplicates' }).click();
  await expectVisible(
    page,
    page.getByText('Imported 1 saved template. 1 duplicate name was renamed.'),
    'Expected saved template import to report duplicate label handling.',
  );
  await expectVisible(
    page,
    page.getByRole('button', { name: 'Add Smoke renamed contact (imported)' }),
    'Expected imported duplicate saved template to receive a unique label.',
  );
  await expectVisible(
    page,
    page.getByText(/Section .* 3 fields .* Created .* Imported/),
    'Expected imported saved template metadata.',
  );
  await savedTemplateImportInput(page).setInputFiles(exportedTemplatePath);
  await page.getByRole('button', { name: 'Skip duplicates' }).click();
  await expectVisible(
    page,
    page.getByText('No saved templates imported. 1 duplicate name was skipped.'),
    'Expected saved template import review to skip duplicate labels.',
  );
  assert.equal(
    await page.getByRole('button', { name: 'Add Smoke renamed contact (imported 2)' }).count(),
    0,
    'Expected skipped duplicate import not to create another renamed template.',
  );
  await savedTemplateImportInput(page).setInputFiles(exportedTemplatePath);
  await page.getByRole('button', { name: 'Replace existing' }).click();
  await expectVisible(
    page,
    page.getByText('Imported 1 saved template. 1 existing template was replaced.'),
    'Expected saved template import review to replace duplicate labels.',
  );
  await page.getByRole('button', { name: 'Delete Smoke renamed contact (imported)', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Smoke renamed contact', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved templates' }).waitFor({ state: 'detached' });
}

async function smokeReusableTemplates(page) {
  await page.getByRole('button', { name: 'Add Identity' }).click();
  await expectMetric(page, 'Fields', 4);
  const withIdentity = await authoringForm(page);
  assert.ok(
    withIdentity.prefill?.mappings?.some(
      mapping => mapping.source === 'profile.fullName' && mapping.target === 'fullName',
    ),
    'Expected identity template full-name prefill mapping.',
  );
  assert.ok(
    withIdentity.computedValues?.some(
      definition =>
        definition.id === 'identitySummary' &&
        definition.target === 'metadata.identitySummary' &&
        definition.sources?.includes('fullName') &&
        definition.sources?.includes('dateOfBirth'),
    ),
    'Expected identity template computed summary.',
  );

  await page.getByRole('button', { name: 'Add Employment list' }).click();
  const withEmploymentList = await authoringForm(page);
  const employmentChapter = withEmploymentList.chapters.find(chapter => chapter.id.includes('employment'));
  assert.equal(employmentChapter?.type, 'listLoop', 'Expected Employment list to create a list-loop chapter.');
  assert.equal(employmentChapter?.options?.nounSingular, 'employer');
  assert.equal(employmentChapter?.options?.nounPlural, 'employers');
  assert.ok(
    employmentChapter?.pages?.some(screen =>
      screen.components?.some(component => component.label === 'Average monthly income'),
    ),
    'Expected Employment list to include the average monthly income field.',
  );

  await openPatterns(page);
  await page.getByRole('button', { name: 'Add Dependent list' }).click();
  const withDependentList = await authoringForm(page);
  const dependentChapter = withDependentList.chapters.find(chapter => chapter.id.includes('dependents'));
  assert.equal(dependentChapter?.type, 'listLoop', 'Expected Dependent list to create a list-loop chapter.');
  assert.equal(dependentChapter?.options?.nounSingular, 'dependent');
  assert.equal(dependentChapter?.options?.nounPlural, 'dependents');
  assert.ok(
    dependentChapter?.pages?.some(screen =>
      screen.components?.some(component => component.label === "Dependent's full name"),
    ),
    'Expected Dependent list to include dependent identity fields.',
  );
}

async function smokePromotedControls(page) {
  await page.getByRole('tab', { name: 'Canvas' }).click();
  await page.getByRole('tab', { name: 'Fields' }).click();
  await page.getByRole('button', { name: 'Add Table' }).click();
  await expectVisible(
    page,
    page.getByRole('checkbox', { name: 'Use first row as table header' }),
    'Expected table header-row control to render.',
  );
  assert.equal(
    await page.getByRole('checkbox', { name: 'Use first row as table header' }).isChecked(),
    true,
    'Expected new tables to default to header rows.',
  );
  await expectVisible(
    page,
    page.locator('table.usa-table th[scope="col"]').first(),
    'Expected table preview to render column header cells.',
  );

  await page.getByRole('button', { name: 'Add Date range' }).click();
  await page.getByText('Date and time').click();
  await expectVisible(
    page,
    page.getByRole('checkbox', { name: 'Allow future dates' }),
    'Expected Date range inspector to expose the Allow future dates toggle.',
  );
  await page.getByText('Allow future dates').click();
  assert.equal(
    await page.getByRole('checkbox', { name: 'Allow future dates' }).isChecked(),
    true,
    'Expected Allow future dates to be checked after toggling the control.',
  );
  const withDateRange = await authoringForm(page);
  const dateRange = flattenComponents(withDateRange).find(component => component.type === 'dateRange');
  assert.equal(dateRange?.allowFutureDates, true, 'Expected Date range future-date setting to persist.');

  return {
    computedCountBeforeDecline: withDateRange.computedValues?.length || 0,
    prefillCountBeforeDecline: withDateRange.prefill?.mappings?.length || 0,
  };
}

async function smokeDeclinedHelperPresets(page, counts) {
  await openPatterns(page);
  await page.getByText('Include helper presets').click();
  assert.equal(
    await page.getByRole('checkbox', { name: 'Include helper presets' }).isChecked(),
    false,
    'Expected helper presets to be declined before inserting another template.',
  );
  await page.getByText('Review helper presets').click();
  await expectVisible(
    page,
    page.getByText('Helper presets are off. Templates will add fields only.'),
    'Expected helper preset review to reflect the off state.',
  );
  await page.getByRole('button', { name: 'Add Contact information' }).click();
  const withDeclinedHelpers = await authoringForm(page);
  assert.equal(
    withDeclinedHelpers.prefill?.mappings?.length || 0,
    counts.prefillCountBeforeDecline,
    'Expected declined helper preset insertion to leave prefill mappings unchanged.',
  );
  assert.equal(
    withDeclinedHelpers.computedValues?.length || 0,
    counts.computedCountBeforeDecline,
    'Expected declined helper preset insertion to leave computed values unchanged.',
  );
}

async function loadCareerGuidanceRunner(page, message) {
  await page.getByRole('tab', { name: 'Canvas' }).click();
  await page.getByRole('tab', { name: 'Files' }).click();
  await page
    .getByRole('button', { name: /^Personalized Career Planning and Guidance \(27-8832\)/ })
    .first()
    .click();
  await expectMetric(page, 'Fields', 37);
  await page.getByRole('tab', { name: 'Run' }).click();
  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Personalized career planning and guidance', exact: true }),
    message,
  );
}

async function fillVeteranIdentity(page, { fullName, ssn, dateOfBirth, vaFileNumber }) {
  await page.getByLabel("Veteran or service member's full name").fill(fullName);
  await page.getByLabel("Veteran or service member's Social Security number").fill(ssn);
  await page.getByLabel("Veteran or service member's date of birth").fill(dateOfBirth);
  await page.getByLabel('VA file number').fill(vaFileNumber);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function fillVeteranContact(page, { street, city, state, zip, phone, email }) {
  await page.getByLabel('Street address').fill(street);
  await page.getByLabel('City').fill(city);
  await page.getByLabel('State').fill(state);
  await page.getByLabel('ZIP code').fill(zip);
  await page.getByLabel("Veteran or service member's phone number").fill(phone);
  await page.getByLabel("Veteran or service member's email address").fill(email);
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function fillSchoolAndService(page, { entered, separated, branch }) {
  await checkLabeledControl(page, 'No');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Date entered active duty').fill(entered);
  await page.getByLabel('Date separated from active duty or projected separation date').fill(separated);
  await page.getByRole('button', { name: 'Continue' }).click();

  await checkLabeledControl(page, branch);
  await checkLabeledControl(page, 'Active');
  await checkLabeledControl(page, 'Honorable');
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function fillCertification(page, { signer, alternateSigner }) {
  await checkLabeledControl(page, /I certify that I have completed this statement/);
  await page.getByLabel('Veteran, service member, or claimant typed signature').fill(signer);
  await page.getByLabel('Date signed').fill('2026-04-25');
  await checkLabeledControl(page, alternateSigner ? 'Yes' : 'No');
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function smokeCareerGuidanceVeteranPath(page) {
  await loadCareerGuidanceRunner(page, 'Expected 27-8832 runner to open on the eligibility page.');

  await checkLabeledControl(page, 'Educational services');
  await page.getByRole('button', { name: 'Continue' }).click();
  await checkLabeledControl(page, 'Veteran or service member');
  await page.getByRole('button', { name: 'Continue' }).click();

  await fillVeteranIdentity(page, {
    dateOfBirth: '1980-01-01',
    fullName: 'Pat Veteran',
    ssn: '123456789',
    vaFileNumber: '12345678',
  });
  await fillVeteranContact(page, {
    city: 'Washington',
    email: 'pat.veteran@example.com',
    phone: '2025550100',
    state: 'DC',
    street: '123 Main St',
    zip: '20001',
  });
  await fillSchoolAndService(page, {
    branch: 'Army',
    entered: '2001-01-01',
    separated: '2005-01-01',
  });

  await page.getByRole('textbox', { name: 'Remarks' }).fill('Smoke test remarks.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await fillCertification(page, { alternateSigner: false, signer: 'Pat Veteran' });

  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Submit this mock form' }),
    'Expected 27-8832 runner review and submit page.',
  );
  assert.equal(
    await page.getByRole('heading', { name: 'Claimant identity' }).count(),
    0,
    'Expected 27-8832 veteran path to skip claimant-only review sections.',
  );
  await page.getByRole('button', { name: 'Submit' }).click();
  await expectVisible(
    page,
    page.getByLabel('Submit this mock form').getByText('Mock submitted'),
    'Expected 27-8832 mock submit to complete successfully.',
  );
}

async function smokeCareerGuidanceDependentPath(page) {
  await loadCareerGuidanceRunner(page, 'Expected 27-8832 dependent runner to restart on the eligibility page.');

  await checkLabeledControl(page, 'Counseling services');
  await page.getByRole('button', { name: 'Continue' }).click();
  await checkLabeledControl(page, 'Dependent claimant');
  await page.getByRole('button', { name: 'Continue' }).click();

  await fillVeteranIdentity(page, {
    dateOfBirth: '1975-05-05',
    fullName: 'Sam Veteran',
    ssn: '987654321',
    vaFileNumber: '87654321',
  });
  await fillVeteranContact(page, {
    city: 'Arlington',
    email: 'sam.veteran@example.com',
    phone: '7035550100',
    state: 'VA',
    street: '500 Service Ave',
    zip: '22201',
  });
  await fillSchoolAndService(page, {
    branch: 'Navy',
    entered: '1999-01-01',
    separated: '2004-01-01',
  });

  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Claimant identification information' }),
    'Expected dependent claimant path to include claimant identity.',
  );
  await page.getByLabel("Claimant's full name").fill('Casey Claimant');
  await page.getByLabel("Claimant's Social Security number").fill('111223333');
  await page.getByLabel("Claimant's date of birth").fill('2005-06-07');
  await page.getByLabel('Claimant VA file number').fill('11223344');
  await checkLabeledControl(page, 'Child');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Street address').fill('900 Claimant Rd');
  await page.getByLabel('City').fill('Richmond');
  await page.getByLabel('State').fill('VA');
  await page.getByLabel('ZIP code').fill('23220');
  await page.getByLabel('Claimant phone number').fill('8045550100');
  await page.getByLabel('Claimant email address').fill('casey.claimant@example.com');
  await checkLabeledControl(page, 'Yes');
  await page.getByLabel('Name of school or training facility').fill('Central Training Institute');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('textbox', { name: 'Remarks' }).fill('Dependent claimant smoke test remarks.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await fillCertification(page, { alternateSigner: true, signer: 'Casey Claimant' });

  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Parent, guardian, or custodian signature' }),
    'Expected alternate signer page for dependent claimant path.',
  );
  await checkLabeledControl(page, 'Parent');
  await page.getByLabel('Parent, guardian, or custodian typed signature').fill('Pat Parent');
  await page.getByLabel('Date signed').fill('2026-04-25');
  await page.getByLabel('Parent, guardian, or custodian phone number').fill('8045550199');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expectVisible(
    page,
    page.getByRole('heading', { name: 'Submit this mock form' }),
    'Expected dependent 27-8832 runner review and submit page.',
  );
  await expectVisible(
    page,
    page.getByRole('heading', { level: 3, name: 'Claimant identity' }),
    'Expected dependent 27-8832 review to include claimant identity.',
  );
  await expectVisible(
    page,
    page.getByRole('heading', { level: 3, name: 'Claimant contact information' }),
    'Expected dependent 27-8832 review to include claimant contact.',
  );
  await page.getByRole('button', { name: 'Submit' }).click();
  await expectVisible(
    page,
    page.getByLabel('Submit this mock form').getByText('Mock submitted'),
    'Expected dependent 27-8832 mock submit to complete successfully.',
  );
}

async function main() {
  const server = startDevServer();
  let browser;
  let context;

  try {
    await waitForServer(server);
    browser = await chromium.launch();
    context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1600, height: 1200 },
    });
    const page = await context.newPage();
    const browserErrors = trackBrowserErrors(page);

    await loadBlankBuilder(page);
    await smokeCuratedPdfImport(page);
    await loadBlankBuilder(page);
    await smokeBasicAuthoringAndRunner(page);
    await smokeHelperPresetReview(page);
    await smokeSavedTemplateLibrary(page);
    await smokeReusableTemplates(page);
    const counts = await smokePromotedControls(page);
    await smokeDeclinedHelperPresets(page, counts);
    await smokeCareerGuidanceVeteranPath(page);
    await smokeCareerGuidanceDependentPath(page);

    assert.deepEqual(browserErrors, [], `Unexpected browser errors:\n${browserErrors.join('\n')}`);
  } finally {
    await context?.close();
    await browser?.close();
    await server.stop();
  }
}

await main();
