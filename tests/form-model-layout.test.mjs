import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addComponentToPageAt,
  moveComponentToPageAt,
  normalizeHorizontalComponentRows,
  rowComponentIdsForComponent,
} from '../apps/builder/src/lib/formModel.ts';

function component(id, layoutWidth = 'full', layoutNewRow) {
  return {
    id,
    type: 'textInput',
    label: id,
    layoutWidth,
    ...(layoutNewRow === undefined ? {} : { layoutNewRow }),
  };
}

function formWithComponents(components) {
  return {
    schemaVersion: '1.1.0',
    formId: 'test-form',
    title: 'Test form',
    chapters: [
      {
        id: 'chapter',
        title: 'Chapter',
        pages: [
          {
            id: 'page',
            title: 'Page',
            components,
          },
        ],
      },
    ],
  };
}

const selectedPage = {
  chapterId: 'chapter',
  pageId: 'page',
  componentId: undefined,
};

function currentComponents(form) {
  return form.chapters[0].pages[0].components;
}

function byId(form, id) {
  return currentComponents(form).find(componentItem => componentItem.id === id);
}

test('side drop beside a field creates a two-up half-width row', () => {
  const form = formWithComponents([component('a', 'full')]);
  const siblingRow = rowComponentIdsForComponent(form, selectedPage, 'a');
  const inserted = addComponentToPageAt(form, selectedPage, 'textInput', 1, 'half');
  const next = normalizeHorizontalComponentRows(
    inserted.form,
    selectedPage,
    [...siblingRow, inserted.componentId],
    { preferWrapId: inserted.componentId },
  );

  assert.equal(byId(next, 'a')?.layoutWidth, 'half');
  assert.equal(byId(next, inserted.componentId)?.layoutWidth, 'half');
});

test('side drop into an existing two-up row rebalances to three thirds', () => {
  const form = formWithComponents([
    component('a', 'half'),
    component('b', 'half'),
  ]);
  const siblingRow = rowComponentIdsForComponent(form, selectedPage, 'a');
  const inserted = addComponentToPageAt(form, selectedPage, 'textInput', 1, 'half');
  const next = normalizeHorizontalComponentRows(
    inserted.form,
    selectedPage,
    [...siblingRow, inserted.componentId],
    { preferWrapId: inserted.componentId },
  );

  assert.equal(byId(next, 'a')?.layoutWidth, 'third');
  assert.equal(byId(next, 'b')?.layoutWidth, 'third');
  assert.equal(byId(next, inserted.componentId)?.layoutWidth, 'third');
});

test('side drop into an existing three-up row keeps existing three and wraps dropped field', () => {
  const form = formWithComponents([
    component('a', 'third'),
    component('b', 'third'),
    component('c', 'third'),
  ]);
  const siblingRow = rowComponentIdsForComponent(form, selectedPage, 'b');
  const inserted = addComponentToPageAt(form, selectedPage, 'textInput', 2, 'half');
  const next = normalizeHorizontalComponentRows(
    inserted.form,
    selectedPage,
    [...siblingRow, inserted.componentId],
    { preferWrapId: inserted.componentId },
  );

  assert.equal(byId(next, 'a')?.layoutWidth, 'third');
  assert.equal(byId(next, 'b')?.layoutWidth, 'third');
  assert.equal(byId(next, 'c')?.layoutWidth, 'third');
  assert.equal(byId(next, inserted.componentId)?.layoutWidth, 'full');
  assert.equal(byId(next, inserted.componentId)?.layoutNewRow, true);
});

test('moving beside another row rebalances both target and source rows', () => {
  const form = formWithComponents([
    component('x', 'third'),
    component('y', 'third'),
    component('z', 'third'),
    component('a', 'half'),
    component('b', 'half'),
  ]);
  const sourceNode = {
    chapterId: 'chapter',
    pageId: 'page',
    componentId: 'y',
  };

  const sourceRow = rowComponentIdsForComponent(form, sourceNode, 'y');
  const targetRow = rowComponentIdsForComponent(form, selectedPage, 'a');
  const moved = moveComponentToPageAt(form, sourceNode, selectedPage, 4, 'half');
  let next = normalizeHorizontalComponentRows(moved, selectedPage, [...targetRow, 'y'], {
    preferWrapId: 'y',
  });
  next = normalizeHorizontalComponentRows(
    next,
    sourceNode,
    sourceRow.filter(componentId => componentId !== 'y'),
  );

  assert.equal(byId(next, 'x')?.layoutWidth, 'half');
  assert.equal(byId(next, 'z')?.layoutWidth, 'half');
  assert.equal(byId(next, 'a')?.layoutWidth, 'third');
  assert.equal(byId(next, 'b')?.layoutWidth, 'third');
  assert.equal(byId(next, 'y')?.layoutWidth, 'third');
});

test('vertical move without side-drop normalization keeps existing move behavior', () => {
  const form = formWithComponents([
    component('a', 'half'),
    component('b', 'half'),
    component('c', 'full', true),
  ]);
  const sourceNode = {
    chapterId: 'chapter',
    pageId: 'page',
    componentId: 'a',
  };
  const moved = moveComponentToPageAt(form, sourceNode, selectedPage, 2, 'full');

  assert.equal(currentComponents(moved).map(item => item.id).join(','), 'b,a,c');
  assert.equal(byId(moved, 'a')?.layoutWidth, 'full');
  assert.equal(byId(moved, 'b')?.layoutWidth, 'half');
  assert.equal(byId(moved, 'c')?.layoutWidth, 'full');
});
