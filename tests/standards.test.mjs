import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  auditForm,
  auditFormAgainstDefaults,
  DEFAULT_PRIORITY_ORDER,
  evaluatePredicate,
  loadBuiltInRules,
  loadDefaultStandards,
  mergeRules,
  predicateOps,
} from '../src/index.mjs';

function readExample(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const example21 = readExample('../examples/21-4140-authoring.json');
const example27 = readExample('../examples/27-8832-authoring.json');

test('predicateOps exposes the V1 predicate vocabulary', () => {
  const ops = predicateOps();
  assert.ok(ops.includes('and'));
  assert.ok(ops.includes('or'));
  assert.ok(ops.includes('not'));
  assert.ok(ops.includes('pathExists'));
  assert.ok(ops.includes('pathEquals'));
  assert.ok(ops.includes('count'));
  assert.ok(ops.includes('anyChapterHas'));
  assert.ok(ops.includes('anyComponentHas'));
  assert.ok(ops.includes('componentTypeIn'));
  assert.ok(ops.includes('stringLength'));
  assert.ok(ops.includes('stringMatches'));
  assert.ok(ops.includes('stringNonEmpty'));
  assert.ok(ops.includes('numberInRange'));
  assert.ok(ops.includes('enumIn'));
  assert.ok(ops.includes('fieldEquals'));
});

test('evaluatePredicate handles structural predicates', () => {
  const scope = { chapters: [{ id: 'a', pages: [{ id: 'p1', components: [] }] }] };
  assert.equal(
    evaluatePredicate({ op: 'count', path: 'chapters', compare: '>=', value: 1 }, scope),
    true,
  );
  assert.equal(
    evaluatePredicate({ op: 'count', path: 'chapters', compare: '>=', value: 5 }, scope),
    false,
  );
  assert.equal(
    evaluatePredicate(
      { op: 'anyChapterHas', where: { op: 'fieldEquals', field: 'id', value: 'a' } },
      scope,
    ),
    true,
  );
});

test('evaluatePredicate handles content predicates on a component scope', () => {
  const component = { id: 'veteranName', label: 'Veteran name', type: 'textInput' };
  assert.equal(
    evaluatePredicate(
      { op: 'stringLength', field: 'label', min: 2, max: 200 },
      component,
    ),
    true,
  );
  assert.equal(
    evaluatePredicate(
      { op: 'stringMatches', field: 'id', pattern: '^[a-z][a-zA-Z0-9]*$' },
      component,
    ),
    true,
  );
});

test('evaluatePredicate boolean composition (and / or / not)', () => {
  const scope = { x: 1, y: 'hi' };
  assert.equal(
    evaluatePredicate(
      {
        op: 'and',
        predicates: [
          { op: 'pathEquals', path: 'x', value: 1 },
          { op: 'stringNonEmpty', field: 'y' },
        ],
      },
      scope,
    ),
    true,
  );
  assert.equal(
    evaluatePredicate(
      {
        op: 'or',
        predicates: [
          { op: 'pathEquals', path: 'x', value: 5 },
          { op: 'pathEquals', path: 'x', value: 1 },
        ],
      },
      scope,
    ),
    true,
  );
  assert.equal(
    evaluatePredicate(
      { op: 'not', predicate: { op: 'pathEquals', path: 'x', value: 5 } },
      scope,
    ),
    true,
  );
});

test('loadBuiltInRules returns at least the seeded VA rules', () => {
  const rules = loadBuiltInRules();
  assert.ok(rules.length >= 15);
  assert.ok(rules.some(r => r.id === 'va.metadata.formId-required'));
  assert.ok(rules.some(r => r.id === 'va.fileUpload.endpoint-required'));
  assert.ok(rules.some(r => r.id === 'va.listLoop.options-required'));
});

test('loadDefaultStandards returns merged + sorted rules with priority metadata', () => {
  const standards = loadDefaultStandards();
  assert.deepEqual(standards.priorityOrder, DEFAULT_PRIORITY_ORDER);
  assert.ok(standards.sources.includes('builtIn'));
  assert.ok(standards.rules.length >= 15);
  standards.rules.forEach(rule => assert.ok(rule.id, 'rule must have id'));
});

test('mergeRules respects priority order on conflicting ids', () => {
  const merged = mergeRules(
    {
      builtIn: [{ id: 'rule.a', message: 'from-builtIn' }],
      external: [{ id: 'rule.a', message: 'from-external' }],
    },
    DEFAULT_PRIORITY_ORDER,
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'external');
  assert.equal(merged[0].message, 'from-external');
});

test('mergeRules concatenates non-conflicting rules from multiple sources', () => {
  const merged = mergeRules(
    {
      builtIn: [{ id: 'rule.a' }, { id: 'rule.b' }],
      external: [{ id: 'rule.c' }],
    },
    DEFAULT_PRIORITY_ORDER,
  );
  assert.deepEqual(
    merged.map(r => r.id),
    ['rule.a', 'rule.b', 'rule.c'],
  );
});

test('auditForm reports zero blockers on retro-stamped 21-4140 example', () => {
  const result = auditFormAgainstDefaults(example21);
  assert.equal(result.pass, true, JSON.stringify(result.blockers, null, 2));
  assert.equal(result.blockers.length, 0);
});

test('auditForm reports zero blockers on retro-stamped 27-8832 example', () => {
  const result = auditFormAgainstDefaults(example27);
  assert.equal(result.pass, true, JSON.stringify(result.blockers, null, 2));
  assert.equal(result.blockers.length, 0);
});

test('auditForm flags missing label as error', () => {
  const broken = {
    ...example21,
    chapters: [
      {
        ...example21.chapters[0],
        pages: [
          {
            ...example21.chapters[0].pages[0],
            components: [
              { id: 'broken', type: 'textInput', label: '' },
            ],
          },
        ],
      },
    ],
  };
  const result = auditForm(broken, loadBuiltInRules());
  const labelBlocker = result.blockers.find(b => b.ruleId === 'va.content.label-required');
  assert.ok(labelBlocker, 'should flag missing label as blocker');
  assert.equal(labelBlocker.componentId, 'broken');
});

test('auditForm flags fileUpload missing endpoint', () => {
  const form = {
    schemaVersion: '1.1.0',
    formId: 'test',
    title: 'Test',
    rootUrl: '/test',
    submitUrl: '/v0/test',
    plainLanguageHeader: 'Test',
    trackingPrefix: 'test-',
    componentSystems: { primary: 'uswds' },
    source: { kind: 'manual' },
    chapters: [
      {
        id: 'a',
        title: 'A',
        pages: [
          {
            id: 'p',
            title: 'Page',
            components: [
              { id: 'upload', type: 'fileUpload', label: 'Upload' },
            ],
          },
        ],
      },
      {
        id: 'b',
        title: 'B',
        pages: [{ id: 'p2', title: 'Page 2', components: [{ id: 'x', type: 'textInput', label: 'X' }] }],
      },
    ],
  };
  const result = auditForm(form, loadBuiltInRules());
  const endpointBlocker = result.blockers.find(b => b.ruleId === 'va.fileUpload.endpoint-required');
  assert.ok(endpointBlocker, 'should flag missing endpoint');
  assert.equal(endpointBlocker.componentId, 'upload');
});

test('auditForm scope=page flags empty pages', () => {
  const form = {
    schemaVersion: '1.1.0',
    formId: 'test',
    title: 'Test',
    rootUrl: '/test',
    submitUrl: '/v0/test',
    plainLanguageHeader: 'Test',
    trackingPrefix: 'test-',
    componentSystems: { primary: 'uswds' },
    source: { kind: 'manual' },
    chapters: [
      {
        id: 'a',
        title: 'A',
        pages: [{ id: 'empty', title: 'Empty', components: [] }],
      },
      {
        id: 'b',
        title: 'B',
        pages: [{ id: 'p', title: 'P', components: [{ id: 'x', type: 'textInput', label: 'X' }] }],
      },
    ],
  };
  const result = auditForm(form, loadBuiltInRules());
  const emptyBlocker = result.blockers.find(b => b.ruleId === 'va.structure.no-empty-page');
  assert.ok(emptyBlocker);
  assert.equal(emptyBlocker.pageId, 'empty');
});
