import fs from 'node:fs';
import { generateVaFormConfigModule } from '../generator/vaFormConfigGenerator.mjs';

const [, , inputPath] = process.argv;

if (!inputPath) {
  console.error('Usage: node src/cli/compile.mjs <authoring-form.json>');
  process.exit(1);
}

const form = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
process.stdout.write(generateVaFormConfigModule(form, { includeManifestImport: false }));
