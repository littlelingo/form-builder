import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from 'playwright';

const port = Number(process.env.BUILDER_SMOKE_PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const repoRoot = new URL('..', import.meta.url);
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
      ? page.getByText(label, { exact: true })
      : page.getByText(label);
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
    const browserErrors = [];

    page.on('console', message => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.includes('favicon.ico')) return;
      browserErrors.push(text);
    });
    page.on('pageerror', error => browserErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    await expectVisible(
      page,
      page.getByRole('heading', { name: 'Start building' }),
      'Expected the blank builder canvas to load.',
    );

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

    await page.getByRole('tab', { name: 'Canvas' }).click();
    await page.getByRole('tab', { name: 'Patterns' }).click();
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
    await page.getByRole('button', { name: 'Add Contact information' }).click();
    await expectMetric(page, 'Fields', 2);

    await page.getByLabel('Template name').fill('Smoke saved contact');
    await page.getByRole('button', { name: 'Save section' }).click();
    await expectVisible(
      page,
      page.getByRole('heading', { name: 'Saved templates' }),
      'Expected saved templates group to appear.',
    );

    await page
      .getByRole('button', { name: 'Add Smoke saved contact' })
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

    await page.getByRole('button', { name: 'Delete Smoke saved contact' }).click();
    await page.getByRole('heading', { name: 'Saved templates' }).waitFor({ state: 'detached' });

    await page.locator('input[type="file"]').setInputFiles(exportedTemplatePath);
    await expectVisible(
      page,
      page.getByRole('heading', { name: 'Saved templates' }),
      'Expected saved template import to restore the Saved templates group.',
    );
    await page.getByRole('button', { name: 'Delete Smoke saved contact' }).click();
    await page.getByRole('heading', { name: 'Saved templates' }).waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Add Identity' }).click();
    await expectMetric(page, 'Fields', 4);
    const withIdentityAuthoringJson = await page
      .locator('.builder-output__panel')
      .first()
      .locator('pre')
      .textContent();
    const withIdentity = JSON.parse(withIdentityAuthoringJson || '{}');
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

    const prefillCountBeforeDecline = withDateRange.prefill?.mappings?.length || 0;
    const computedCountBeforeDecline = withDateRange.computedValues?.length || 0;
    await page.getByRole('tab', { name: 'Canvas' }).click();
    await page.getByRole('tab', { name: 'Patterns' }).click();
    await page.getByText('Include helper presets').click();
    assert.equal(
      await page.getByRole('checkbox', { name: 'Include helper presets' }).isChecked(),
      false,
      'Expected helper presets to be declined before inserting another template.',
    );
    await page.getByRole('button', { name: 'Add Contact information' }).click();
    const withDeclinedHelpers = await authoringForm(page);
    assert.equal(
      withDeclinedHelpers.prefill?.mappings?.length || 0,
      prefillCountBeforeDecline,
      'Expected declined helper preset insertion to leave prefill mappings unchanged.',
    );
    assert.equal(
      withDeclinedHelpers.computedValues?.length || 0,
      computedCountBeforeDecline,
      'Expected declined helper preset insertion to leave computed values unchanged.',
    );

    await page.getByRole('tab', { name: 'Canvas' }).click();
    await page.getByRole('tab', { name: 'Files' }).click();
    await page.getByRole('button', { name: 'Personalized Career Planning and Guidance (27-8832)' }).click();
    await expectMetric(page, 'Fields', 37);
    await page.getByRole('tab', { name: 'Run' }).click();
    await expectVisible(
      page,
      page.getByRole('heading', { name: 'Personalized career planning and guidance', exact: true }),
      'Expected 27-8832 runner to open on the eligibility page.',
    );

    await checkLabeledControl(page, 'Educational services');
    await page.getByRole('button', { name: 'Continue' }).click();
    await checkLabeledControl(page, 'Veteran or service member');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel("Veteran or service member's full name").fill('Pat Veteran');
    await page.getByLabel("Veteran or service member's Social Security number").fill('123456789');
    await page.getByLabel("Veteran or service member's date of birth").fill('1980-01-01');
    await page.getByLabel('VA file number').fill('12345678');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel('Street address').fill('123 Main St');
    await page.getByLabel('City').fill('Washington');
    await page.getByLabel('State').fill('DC');
    await page.getByLabel('ZIP code').fill('20001');
    await page.getByLabel("Veteran or service member's phone number").fill('2025550100');
    await page.getByLabel("Veteran or service member's email address").fill('pat.veteran@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();

    await checkLabeledControl(page, 'No');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByLabel('Date entered active duty').fill('2001-01-01');
    await page.getByLabel('Date separated from active duty or projected separation date').fill('2005-01-01');
    await page.getByRole('button', { name: 'Continue' }).click();

    await checkLabeledControl(page, 'Army');
    await checkLabeledControl(page, 'Active');
    await checkLabeledControl(page, 'Honorable');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('textbox', { name: 'Remarks' }).fill('Smoke test remarks.');
    await page.getByRole('button', { name: 'Continue' }).click();

    await checkLabeledControl(page, /I certify that I have completed this statement/);
    await page.getByLabel('Veteran, service member, or claimant typed signature').fill('Pat Veteran');
    await page.getByLabel('Date signed').fill('2026-04-25');
    await checkLabeledControl(page, 'No');
    await page.getByRole('button', { name: 'Continue' }).click();

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

    assert.deepEqual(browserErrors, [], `Unexpected browser errors:\n${browserErrors.join('\n')}`);
  } finally {
    await context?.close();
    await browser?.close();
    await server.stop();
  }
}

await main();
