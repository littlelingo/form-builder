#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { argv, exit, stderr, stdout } from 'node:process';

import { importPdf } from '../import/pipeline.mjs';

function parseArgs(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out') {
      flags.out = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--form-id=')) {
      flags.formId = arg.slice('--form-id='.length);
    } else if (arg.startsWith('--title=')) {
      flags.title = arg.slice('--title='.length);
    } else if (arg.startsWith('--')) {
      stderr.write(`Unknown flag: ${arg}\n`);
      exit(2);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseArgs(argv.slice(2));
  if (positional.length === 0) {
    stderr.write('Usage: import.mjs <pdf-path> [--out <dir>] [--form-id=<id>] [--title="..."]\n');
    exit(2);
  }

  const pdfPath = resolve(positional[0]);
  const pdfBytes = readFileSync(pdfPath);
  const filename = basename(pdfPath);

  const result = await importPdf(pdfBytes, {
    filename,
    formId: flags.formId,
    title: flags.title,
  });

  if (flags.out) {
    const outDir = resolve(flags.out);
    mkdirSync(outDir, { recursive: true });
    const formId = result.form.formId;
    const jsonPath = `${outDir}/${formId}-authoring.json`;
    writeFileSync(jsonPath, `${JSON.stringify(result.form, null, 2)}\n`);
    const sidecarPath = `${outDir}/source.pdf`;
    copyFileSync(pdfPath, sidecarPath);
    const reportPath = `${outDir}/import-report.json`;
    writeFileSync(reportPath, `${JSON.stringify(result.importReport, null, 2)}\n`);
    stdout.write(`Wrote ${jsonPath}\n`);
    stdout.write(`Wrote ${sidecarPath}\n`);
    stdout.write(`Wrote ${reportPath}\n`);
    stdout.write(
      `Enrichment: provider=${result.importReport.enrichment.provider} reason=${result.importReport.enrichment.reason}${result.importReport.enrichment.cacheHit ? ' (cache-hit)' : ''}\n`,
    );
    if (result.importReport.enrichment.error) {
      stdout.write(`Enrichment error: ${result.importReport.enrichment.error}\n`);
    }
  } else {
    stdout.write(JSON.stringify(result.form, null, 2));
    stdout.write('\n');
  }

  if (!result.importReport.validation.valid) {
    stderr.write('Validation errors:\n');
    for (const err of result.importReport.validation.errors) {
      stderr.write(`  - ${err}\n`);
    }
    exit(1);
  }
}

main().catch(err => {
  stderr.write(`${err.stack || err.message}\n`);
  exit(1);
});
