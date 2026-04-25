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

function collectComponentIds(components = []) {
  return components.flatMap(component => [
    component.id,
    ...collectComponentIds(component.children || []),
  ]);
}

async function main() {
  const server = startDevServer();
  let browser;
  let context;

  try {
    await waitForServer(server);
    browser = await chromium.launch();
    context = await browser.newContext({ acceptDownloads: true });
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

    await page.getByRole('tab', { name: 'Code' }).click();
    const authoringJson = await page
      .locator('.builder-output__panel')
      .first()
      .locator('pre')
      .textContent();
    const parsed = JSON.parse(authoringJson || '{}');
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

    assert.deepEqual(browserErrors, [], `Unexpected browser errors:\n${browserErrors.join('\n')}`);
  } finally {
    await context?.close();
    await browser?.close();
    await server.stop();
  }
}

await main();
