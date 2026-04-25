import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { validateAuthoringForm } from '../src/index.mjs';
import { importPdf } from '../src/import/pipeline.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoVa9Path = `${here}fixtures/pilot/VA9-2020.pdf`;
const fallbackVa9Path = '/Users/clint/Downloads/va9_2020.pdf';
const va9Path = process.env.VA9_PDF_PATH || (existsSync(repoVa9Path) ? repoVa9Path : fallbackVa9Path);
const va9Available = existsSync(va9Path);

function flattenComponents(form) {
  return form.chapters.flatMap(chapter =>
    chapter.pages.flatMap(page => page.components),
  );
}

function pageIds(chapter) {
  return new Set((chapter?.pages || []).map(page => page.id));
}

test(
  'VA9 static PDF import uses recipe data to produce a curated appeal workflow',
  { skip: !va9Available && `VA9 PDF not present at ${va9Path}` },
  async () => {
    const pdfBytes = readFileSync(va9Path);
    const { form, importReport } = await importPdf(pdfBytes, {
      filename: 'va9_2020.pdf',
      formId: 'VA9-imported',
      title: 'Appeal to Board of Veterans Appeals',
      enrich: false,
    });

    assert.equal(importReport.acroFormFieldCount, 0);
    assert.ok(importReport.componentCount >= 15);
    assert.equal(importReport.curation.status, 'curated');
    assert.equal(importReport.curation.recipe.recipeId, 'va9-appeal-2020-static');
    assert.ok(importReport.curation.recipe.matchedFieldCount >= 15);
    assert.ok(importReport.curation.curatedFieldCount >= 15);

    const validation = validateAuthoringForm(form);
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const chapters = Object.fromEntries(form.chapters.map(chapter => [chapter.id, chapter]));
    assert.ok(chapters.claimantInformation, 'claimant information chapter should exist');
    assert.ok(chapters.appealDetails, 'appeal details chapter should exist');
    assert.ok(chapters.boardHearing, 'board hearing chapter should exist');
    assert.ok(chapters.signatures, 'signatures chapter should exist');

    assert.ok(pageIds(chapters.claimantInformation).has('veteranIdentification'));
    assert.ok(pageIds(chapters.claimantInformation).has('relationshipAndContact'));
    assert.ok(pageIds(chapters.appealDetails).has('issuesOnAppeal'));
    assert.ok(pageIds(chapters.appealDetails).has('disagreementExplanation'));
    assert.ok(pageIds(chapters.signatures).has('appealSignature'));

    const components = Object.fromEntries(flattenComponents(form).map(component => [component.id, component]));
    for (const id of [
      'nameOfVeteran',
      'claimFileNumber',
      'iAmThe',
      'issuesAppealScope',
      'issuesToAppeal',
      'whyVaDecidedIncorrectly',
      'optionalBoardHearing',
      'appealSignature',
    ]) {
      assert.ok(components[id], `${id} should be present`);
      assert.equal(components[id].provenance.origin, 'pdf-static-region');
      assert.equal(components[id].provenance.curation.source, 'recipe');
    }

    assert.deepEqual(components.claimantName.showIf, {
      field: 'iAmThe',
      operator: 'notEquals',
      value: 'veteran',
    });
    assert.deepEqual(components.issuesToAppeal.showIf, {
      field: 'issuesAppealScope',
      operator: 'equals',
      value: 'iAmOnlyAppealingTheseIssues',
    });
  },
);
