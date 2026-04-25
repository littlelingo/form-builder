import { useState } from 'react';

import { AuditPanel } from './components/AuditPanel';
import { BuildToolbox } from './components/BuildToolbox';
import { BuilderToolbar } from './components/BuilderToolbar';
import { FlowEditorPanel } from './components/FlowEditorPanel';
import { FormActions } from './components/FormActions';
import { InspectorPanel } from './components/InspectorPanel';
import { MetadataEditor } from './components/MetadataEditor';
import { OutputPanel } from './components/OutputPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { RunnerPanel } from './components/RunnerPanel';
import type { RunnerState } from './components/RunnerPanel';
import { StructurePanel } from './components/StructurePanel';
import {
  blankAuthoringForm,
  builderExamples,
  exampleAuthoringForm,
} from './data/exampleAuthoringForm';
import {
  addComponentToPageAt,
  addScreenTemplateToChapter,
  addSectionTemplateToPage,
  addSectionFromTemplate,
  allComponents,
  addComponentToPage,
  addCustomScreenTemplateToChapter,
  addCustomSectionTemplateToPage,
  cloneForm,
  duplicateComponent,
  findChapter,
  findComponent,
  findPage,
  firstSelectableNode,
  moveChapterToIndex,
  moveComponentToPageAt,
  movePageToIndex,
  previewTemplateAuthoringHelpers,
  removeChapter,
  removeComponent,
  removePage,
  setComponentRowStart,
  setComponentLayoutWidth,
  updateComponent,
  updateChapter,
  updateMetadata,
  updatePage,
} from './lib/formModel';
import { emptyRuntimeState } from './lib/runnerRuntime';
import type {
  LayoutWidth,
  ScreenTemplateId,
  SectionTemplateId,
  TemplateInsertionOptions,
} from './lib/formModel';
import type {
  AuthoringComponent,
  AuthoringForm,
  ComponentSystemId,
  PaletteDragItem,
  PreviewData,
  SavedCustomTemplate,
  SelectedNode,
} from './types';

type WorkspacePanel = 'preview' | 'runner' | 'output';
type ToolboxPanel = 'build' | 'outline' | 'files';
type PropertiesPanel = 'setup' | 'properties' | 'audit';
interface FormHistory {
  past: AuthoringForm[];
  future: AuthoringForm[];
}

const CUSTOM_TEMPLATE_STORAGE_KEY = 'va-form-builder.customTemplates.v1';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function countTemplateFields(components: AuthoringComponent[] = []): number {
  return components.reduce(
    (count, component) =>
      count + (component.type === 'sectionGroup' ? 0 : 1) + countTemplateFields(component.children || []),
    0,
  );
}

function savedTemplateFieldCount(template: Partial<SavedCustomTemplate>) {
  if (typeof template.fieldCount === 'number' && Number.isFinite(template.fieldCount)) {
    return Math.max(0, Math.floor(template.fieldCount));
  }
  if (template.kind === 'screen') return countTemplateFields(template.page?.components || []);
  if (template.kind === 'section') return countTemplateFields(template.component?.children || []);
  return 0;
}

function normalizeCustomTemplate(value: unknown): SavedCustomTemplate | null {
  if (!value || typeof value !== 'object') return null;
  const template = value as Partial<SavedCustomTemplate>;
  if (
    typeof template.id !== 'string' ||
    typeof template.label !== 'string' ||
    (template.kind !== 'screen' && template.kind !== 'section')
  ) {
    return null;
  }

  if (template.kind === 'screen') {
    if (
      !template.page ||
      typeof template.page.id !== 'string' ||
      typeof template.page.title !== 'string' ||
      !Array.isArray(template.page.components)
    ) {
      return null;
    }
  }

  if (template.kind === 'section') {
    if (
      !template.component ||
      typeof template.component.id !== 'string' ||
      typeof template.component.type !== 'string' ||
      typeof template.component.label !== 'string'
    ) {
      return null;
    }
  }

  return {
    id: template.id,
    kind: template.kind,
    label: template.label,
    description: typeof template.description === 'string' ? template.description : undefined,
    createdAt: typeof template.createdAt === 'string' ? template.createdAt : new Date().toISOString(),
    importedAt: typeof template.importedAt === 'string' ? template.importedAt : undefined,
    fieldCount: savedTemplateFieldCount(template),
    ...(template.kind === 'screen' ? { page: cloneJson(template.page) } : {}),
    ...(template.kind === 'section' ? { component: cloneJson(template.component) } : {}),
  };
}

function normalizeCustomTemplates(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(normalizeCustomTemplate)
        .filter((template): template is SavedCustomTemplate => Boolean(template))
    : [];
}

function uniqueImportedTemplateLabel(label: string, usedLabels: Set<string>) {
  const baseLabel = label.trim() || 'Imported template';
  const labelKey = baseLabel.toLowerCase();
  if (!usedLabels.has(labelKey)) {
    usedLabels.add(labelKey);
    return baseLabel;
  }

  let index = 1;
  let nextLabel = `${baseLabel} (imported)`;
  while (usedLabels.has(nextLabel.toLowerCase())) {
    index += 1;
    nextLabel = `${baseLabel} (imported ${index})`;
  }
  usedLabels.add(nextLabel.toLowerCase());
  return nextLabel;
}

function loadCustomTemplates(): SavedCustomTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_TEMPLATE_STORAGE_KEY) || '[]');
    return normalizeCustomTemplates(parsed);
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: SavedCustomTemplate[]) {
  window.localStorage.setItem(CUSTOM_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function downloadCustomTemplates(templates: SavedCustomTemplate[]) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          templates,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'va-form-builder-saved-templates.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

function initialRunnerState(): RunnerState {
  return {
    data: {},
    stepIndex: 0,
    activeListItem: null,
    visitedSteps: [],
    errors: {},
    runtimeState: emptyRuntimeState(),
    eventLog: [],
    submitResult: null,
  };
}

export default function App() {
  const [form, setForm] = useState<AuthoringForm>(() => cloneForm(blankAuthoringForm));
  const [history, setHistory] = useState<FormHistory>({ past: [], future: [] });
  const [baselineForm, setBaselineForm] = useState<AuthoringForm>(() =>
    cloneForm(blankAuthoringForm),
  );
  const [selected, setSelected] = useState<SelectedNode>(() => firstSelectableNode(blankAuthoringForm));
  const [previewData, setPreviewData] = useState<PreviewData>({});
  const [runnerState, setRunnerState] = useState<RunnerState>(() => initialRunnerState());
  const [previewSystem, setPreviewSystem] = useState<ComponentSystemId>('uswds');
  const [workspacePanel, setWorkspacePanel] = useState<WorkspacePanel>('preview');
  const [canvasMode, setCanvasMode] = useState<'edit' | 'preview'>('edit');
  const [toolboxPanel, setToolboxPanel] = useState<ToolboxPanel>('build');
  const [propertiesPanel, setPropertiesPanel] = useState<PropertiesPanel>('setup');
  const [paletteDragItem, setPaletteDragItem] = useState<PaletteDragItem | null>(null);
  const [customTemplates, setCustomTemplates] = useState<SavedCustomTemplate[]>(loadCustomTemplates);

  const selectedComponent = findComponent(form, selected);
  const selectedChapter = findChapter(form, selected.chapterId);
  const selectedPage = findPage(form, selected);
  const availableFields = allComponents(form);
  const helperPresetPreviews = previewTemplateAuthoringHelpers(form);

  function commitForm(nextForm: AuthoringForm) {
    setHistory(current => ({
      past: [...current.past, cloneForm(form)].slice(-50),
      future: [],
    }));
    setForm(nextForm);
  }

  function handleUndo() {
    const previous = history.past[history.past.length - 1];
    if (!previous) return;

    setHistory(current => ({
      past: current.past.slice(0, -1),
      future: [cloneForm(form), ...current.future],
    }));
    setForm(cloneForm(previous));
    setSelected(firstSelectableNode(previous));
  }

  function handleRedo() {
    const next = history.future[0];
    if (!next) return;

    setHistory(current => ({
      past: [...current.past, cloneForm(form)].slice(-50),
      future: current.future.slice(1),
    }));
    setForm(cloneForm(next));
    setSelected(firstSelectableNode(next));
  }

  function handleMetadataChange(patch: Partial<AuthoringForm>) {
    commitForm(updateMetadata(form, patch));
  }

  function handleAddComponent(type: string) {
    if (!selected.chapterId || !selected.pageId) {
      const section = addSectionFromTemplate(form, 'standard');
      const result = addComponentToPage(section.form, section.selected, type);
      commitForm(result.form);
      setSelected({
        ...section.selected,
        componentId: result.componentId,
      });
      return;
    }

    const result = addComponentToPage(form, selected, type);
    commitForm(result.form);
    setSelected({
      ...selected,
      componentId: result.componentId,
    });
    setPropertiesPanel('properties');
  }

  function handleAddComponentAt(
    type: string,
    index: number,
    layoutWidth: LayoutWidth = 'full',
    siblingId?: string,
  ) {
    if (!selected.chapterId || !selected.pageId) {
      const section = addSectionFromTemplate(form, 'standard');
      const result = addComponentToPageAt(section.form, section.selected, type, index, layoutWidth);
      commitForm(result.form);
      setSelected({
        ...section.selected,
        componentId: result.componentId,
      });
      return;
    }

    const result = addComponentToPageAt(form, selected, type, index, layoutWidth);
    const nextForm = siblingId
      ? setComponentLayoutWidth(
          result.form,
          { ...selected, componentId: siblingId },
          'half',
        )
      : result.form;
    commitForm(nextForm);
    setSelected({
      ...selected,
      componentId: result.componentId,
    });
    setPropertiesPanel('properties');
  }

  function handleAddSectionTemplate(
    templateId: SectionTemplateId,
    index?: number,
    layoutWidth: LayoutWidth = 'full',
    siblingId?: string,
    options?: TemplateInsertionOptions,
  ) {
    const result = addSectionTemplateToPage(form, selected, templateId, index, layoutWidth, options);
    const nextForm = siblingId
      ? setComponentLayoutWidth(
          result.form,
          { ...result.selected, componentId: siblingId },
          'half',
        )
      : result.form;
    commitForm(nextForm);
    setSelected(result.selected);
    setPropertiesPanel('properties');
  }

  function handleAddScreenTemplate(
    templateId: ScreenTemplateId,
    options?: TemplateInsertionOptions,
  ) {
    const section = addSectionFromTemplate(form, 'standard');
    const result = addScreenTemplateToChapter(section.form, section.selected.chapterId, templateId, options);
    const chapter = result.form.chapters.find(item => item.id === section.selected.chapterId);
    const pages = chapter?.pages || [];
    const firstBlankPage = pages[0];
    const nextForm =
      firstBlankPage && firstBlankPage.components.length === 0 && pages.length > 1
        ? {
            ...result.form,
            chapters: result.form.chapters.map(item =>
              item.id === section.selected.chapterId
                ? {
                    ...item,
                    pages: item.pages.filter(page => page.id !== firstBlankPage.id),
                  }
                : item,
            ),
          }
        : result.form;
    commitForm(nextForm);
    setSelected({ ...result.selected, componentId: undefined });
    setPropertiesPanel('properties');
  }

  function handleAddCustomTemplate(
    templateId: string,
    index?: number,
    layoutWidth: LayoutWidth = 'full',
    siblingId?: string,
  ) {
    const template = customTemplates.find(item => item.id === templateId);
    if (!template) return;

    if (template.kind === 'screen') {
      const section = selected.chapterId
        ? { form, selected }
        : addSectionFromTemplate(form, 'standard');
      const result = addCustomScreenTemplateToChapter(section.form, section.selected.chapterId, template);
      const chapter = result.form.chapters.find(item => item.id === section.selected.chapterId);
      const pages = chapter?.pages || [];
      const firstBlankPage = pages[0];
      const nextForm =
        firstBlankPage && firstBlankPage.components.length === 0 && pages.length > 1
          ? {
              ...result.form,
              chapters: result.form.chapters.map(item =>
                item.id === section.selected.chapterId
                  ? {
                      ...item,
                      pages: item.pages.filter(page => page.id !== firstBlankPage.id),
                    }
                  : item,
              ),
            }
          : result.form;
      commitForm(nextForm);
      setSelected({ ...result.selected, componentId: undefined });
      setPropertiesPanel('properties');
      return;
    }

    const currentSelection =
      selected.chapterId && selected.pageId
        ? { form, selected }
        : addSectionFromTemplate(form, 'standard');
    const result = addCustomSectionTemplateToPage(
      currentSelection.form,
      currentSelection.selected,
      template,
      index,
      layoutWidth,
    );
    const nextForm = siblingId
      ? setComponentLayoutWidth(
          result.form,
          { ...result.selected, componentId: siblingId },
          'half',
        )
      : result.form;
    commitForm(nextForm);
    setSelected(result.selected);
    setPropertiesPanel('properties');
  }

  function handleSaveCustomTemplate(label: string) {
    if (!selectedPage) return;
    const sectionComponent = selectedComponent?.type === 'sectionGroup' ? selectedComponent : undefined;
    const kind = sectionComponent ? 'section' : 'screen';
    const templateLabel = label.trim();
    if (!templateLabel) return;

    const fieldCount = sectionComponent
      ? countTemplateFields(sectionComponent.children || [])
      : countTemplateFields(selectedPage.components);
    const template: SavedCustomTemplate = {
      id: `custom-${Date.now()}`,
      kind,
      label: templateLabel,
      description: `Saved ${kind} with ${fieldCount} field${fieldCount === 1 ? '' : 's'}.`,
      createdAt: new Date().toISOString(),
      fieldCount,
      ...(sectionComponent
        ? { component: cloneJson(sectionComponent) }
        : { page: cloneJson(selectedPage) }),
    };

    setCustomTemplates(current => {
      const next = [template, ...current].slice(0, 25);
      saveCustomTemplates(next);
      return next;
    });
  }

  function handleRenameCustomTemplate(templateId: string, label: string) {
    const nextLabel = label.trim();
    if (!nextLabel) return;

    setCustomTemplates(current => {
      const next = current.map(template =>
        template.id === templateId ? { ...template, label: nextLabel } : template,
      );
      saveCustomTemplates(next);
      return next;
    });
  }

  function handleRemoveCustomTemplate(templateId: string) {
    setCustomTemplates(current => {
      const next = current.filter(template => template.id !== templateId);
      saveCustomTemplates(next);
      return next;
    });
  }

  function handleExportCustomTemplates() {
    downloadCustomTemplates(customTemplates);
  }

  function handleImportCustomTemplates(templates: SavedCustomTemplate[]) {
    const importedAt = new Date().toISOString();
    const usedLabels = new Set(customTemplates.map(template => template.label.toLowerCase()));
    let renamedCount = 0;
    const importedTemplates = normalizeCustomTemplates(templates).map((template, index) => {
      const label = uniqueImportedTemplateLabel(template.label, usedLabels);
      if (label !== template.label) renamedCount += 1;
      return {
        ...template,
        id: `custom-imported-${Date.now()}-${index}`,
        label,
        createdAt: template.createdAt || new Date().toISOString(),
        importedAt,
      };
    });
    if (importedTemplates.length === 0) return 0;

    setCustomTemplates(current => {
      const next = [...importedTemplates, ...current].slice(0, 25);
      saveCustomTemplates(next);
      return next;
    });
    return {
      importedCount: importedTemplates.length,
      renamedCount,
    };
  }

  function handleChapterChange(nextChapter: NonNullable<typeof selectedChapter>) {
    commitForm(updateChapter(form, selected.chapterId, () => nextChapter));
    if (nextChapter.id !== selected.chapterId) {
      setSelected(current => ({
        ...current,
        chapterId: nextChapter.id,
      }));
    }
  }

  function handlePageChange(nextPage: NonNullable<typeof selectedPage>) {
    commitForm(updatePage(form, selected, () => nextPage));
    if (nextPage.id !== selected.pageId) {
      setSelected(current => ({
        ...current,
        pageId: nextPage.id,
      }));
    }
  }

  function handleComponentChange(component: AuthoringComponent) {
    commitForm(updateComponent(form, selected, () => component));
    if (component.id !== selected.componentId) {
      setSelected(current => ({
        ...current,
        componentId: component.id,
      }));
    }
  }

  function handleRemoveComponent() {
    if (!selected.componentId) return;
    handleRemoveComponentNode(selected);
  }

  function handleRemoveComponentNode(node: SelectedNode) {
    if (!node.componentId) return;
    const next = removeComponent(form, node);
    const page = next.chapters
      .find(chapter => chapter.id === node.chapterId)
      ?.pages.find(item => item.id === node.pageId);
    commitForm(next);
    setPreviewData(current => {
      const nextData = { ...current };
      delete nextData[node.componentId as string];
      return nextData;
    });
    if (selected.componentId === node.componentId) {
      setSelected({
        ...node,
        componentId: page?.components[0]?.id,
      });
    }
  }

  function handleDuplicateComponentNode(node: SelectedNode) {
    if (!node.componentId) return;
    const result = duplicateComponent(form, node);
    commitForm(result.form);
    setSelected({
      ...node,
      componentId: result.componentId,
    });
  }

  function handleRemoveChapter() {
    const result = removeChapter(form, selected.chapterId);
    commitForm(result.form);
    setSelected(result.selected);
  }

  function handleRemoveChapterNode(chapterId: string) {
    const result = removeChapter(form, chapterId);
    commitForm(result.form);
    setSelected(result.selected);
  }

  function handleRemoveScreenNode(node: SelectedNode) {
    const chapter = findChapter(form, node.chapterId);
    if (!chapter) return;

    if (chapter.type !== 'listLoop' || chapter.pages.length <= 1) {
      handleRemoveChapterNode(node.chapterId);
      return;
    }

    const result = removePage(form, node);
    commitForm(result.form);
    setSelected(result.selected);
  }

  function handleRemovePage() {
    if (selectedChapter?.type !== 'listLoop' && selectedChapter?.pages.length === 1) {
      handleRemoveChapterNode(selected.chapterId);
      return;
    }

    const result = removePage(form, selected);
    commitForm(result.form);
    setSelected(result.selected);
  }

  function handleMoveScreenToIndex(node: SelectedNode, index: number) {
    const chapter = findChapter(form, node.chapterId);
    if (!chapter) return;
    const nextForm =
      chapter.type === 'listLoop'
        ? movePageToIndex(form, node.chapterId, node.pageId, index)
        : moveChapterToIndex(form, node.chapterId, index);
    commitForm(nextForm);
    setSelected({
      chapterId: node.chapterId,
      pageId: node.pageId,
      componentId: undefined,
    });
  }

  function handleMoveComponentOutline(source: SelectedNode, target: SelectedNode, index: number) {
    commitForm(moveComponentToPageAt(form, source, target, index));
    setSelected(source);
  }

  function handleMoveComponentToIndex(
    node: SelectedNode,
    index: number,
    layoutWidth: LayoutWidth = 'full',
    siblingId?: string,
  ) {
    const moved = moveComponentToPageAt(form, node, selected, index, layoutWidth);
    const nextForm = siblingId
      ? setComponentLayoutWidth(
          moved,
          { ...selected, componentId: siblingId },
          'half',
        )
      : moved;
    commitForm(nextForm);
    setSelected({
      ...selected,
      componentId: node.componentId,
    });
  }

  function handleChangeComponentLayout(
    node: SelectedNode,
    patch: { layoutWidth?: LayoutWidth; layoutNewRow?: boolean },
  ) {
    let nextForm = form;
    if (patch.layoutWidth) {
      nextForm = setComponentLayoutWidth(nextForm, node, patch.layoutWidth);
    }
    if (patch.layoutNewRow !== undefined) {
      nextForm = setComponentRowStart(nextForm, node, patch.layoutNewRow);
    }

    commitForm(nextForm);
    setSelected(node);
  }

  function replaceForm(nextForm: AuthoringForm) {
    const loadedForm = cloneForm(nextForm);
    setForm(loadedForm);
    setHistory({ past: [], future: [] });
    setBaselineForm(cloneForm(loadedForm));
    setSelected(firstSelectableNode(loadedForm));
    setPropertiesPanel('setup');
    setPreviewData({});
    setRunnerState(initialRunnerState());
  }

  function handleImport(nextForm: AuthoringForm) {
    replaceForm(nextForm);
  }

  function handleSelectNode(node: SelectedNode) {
    setSelected(node);
    setPropertiesPanel('properties');
  }

  return (
    <main className="builder-shell">
      <header className="builder-hero">
        <div>
          <p className="builder-eyebrow">VA Form Builder</p>
          <h1>{form.plainLanguageHeader || form.title}</h1>
          <p>{form.formId}</p>
        </div>
        <div className="builder-hero__metrics" aria-label="Current form summary">
          <div>
            <strong>{form.chapters.length}</strong>
            <span>Sections</span>
          </div>
          <div>
            <strong>
              {form.chapters.reduce(
                (count, chapter) =>
                  count +
                  chapter.pages.reduce(
                    (pageCount, page) => pageCount + page.components.length,
                    0,
                  ),
                0,
              )}
            </strong>
            <span>Fields</span>
          </div>
          <div>
            <strong>{form.componentSystems?.additional?.includes('shadcn') ? 'Yes' : 'No'}</strong>
            <span>shadcn</span>
          </div>
        </div>
      </header>

      <div className="builder-layout">
        <aside className="builder-sidebar" aria-label="Authoring controls">
          <div className="builder-toolbox-tabs" role="tablist" aria-label="Toolbox panels">
            <button
              aria-selected={toolboxPanel === 'build'}
              className={toolboxPanel === 'build' ? 'is-active' : ''}
              role="tab"
              type="button"
              onClick={() => setToolboxPanel('build')}
            >
              Build
            </button>
            <button
              aria-selected={toolboxPanel === 'outline'}
              className={toolboxPanel === 'outline' ? 'is-active' : ''}
              role="tab"
              type="button"
              onClick={() => setToolboxPanel('outline')}
            >
              Outline
            </button>
            <button
              aria-selected={toolboxPanel === 'files'}
              className={toolboxPanel === 'files' ? 'is-active' : ''}
              role="tab"
              type="button"
              onClick={() => setToolboxPanel('files')}
            >
              Files
            </button>
          </div>

          {toolboxPanel === 'build' && (
            <BuildToolbox
              canSaveCustomTemplate={Boolean(selectedPage)}
              customTemplates={customTemplates}
              disabled={canvasMode === 'preview'}
              helperPresetPreviews={helperPresetPreviews}
              saveCustomTemplateDefaultName={
                selectedComponent?.type === 'sectionGroup'
                  ? selectedComponent.label
                  : selectedPage?.title || 'Saved screen'
              }
              saveCustomTemplateLabel={
                selectedComponent?.type === 'sectionGroup'
                  ? 'Save section'
                  : 'Save screen'
              }
              onAddCustomTemplate={handleAddCustomTemplate}
              onAddField={handleAddComponent}
              onAddScreen={handleAddScreenTemplate}
              onAddSection={(templateId, options) =>
                handleAddSectionTemplate(templateId, undefined, 'full', undefined, options)
              }
              onExportCustomTemplates={handleExportCustomTemplates}
              onImportCustomTemplates={handleImportCustomTemplates}
              onRemoveCustomTemplate={handleRemoveCustomTemplate}
              onRenameCustomTemplate={handleRenameCustomTemplate}
              onSaveCustomTemplate={handleSaveCustomTemplate}
              onPaletteDragEnd={() => setPaletteDragItem(null)}
              onPaletteDragStart={setPaletteDragItem}
            />
          )}

          {toolboxPanel === 'outline' && (
            <StructurePanel
              form={form}
              selected={selected}
              onMoveComponentToIndex={handleMoveComponentOutline}
              onMoveScreenToIndex={handleMoveScreenToIndex}
              onRemoveChapter={handleRemoveChapterNode}
              onRemoveScreen={handleRemoveScreenNode}
              onSelect={handleSelectNode}
            />
          )}

          {toolboxPanel === 'files' && (
            <FormActions
              examples={builderExamples}
              form={form}
              onImport={handleImport}
              onLoadExample={replaceForm}
              onSetBaseline={() => setBaselineForm(cloneForm(form))}
            />
          )}
        </aside>

        <section className="builder-workspace" aria-label="Form workspace">
          <BuilderToolbar
            activePanel={workspacePanel}
            canvasMode={canvasMode}
            canRedo={history.future.length > 0}
            canUndo={history.past.length > 0}
            previewSystem={previewSystem}
            onCanvasModeChange={setCanvasMode}
            onPanelChange={setWorkspacePanel}
            onPreviewSystemChange={setPreviewSystem}
            onRedo={handleRedo}
            onUndo={handleUndo}
          />
          {workspacePanel === 'preview' ? (
            <PreviewPanel
              canvasMode={canvasMode}
              form={form}
              previewData={previewData}
              previewSystem={previewSystem}
              selected={selected}
              onAddComponent={handleAddComponentAt}
              onAddCustomTemplate={handleAddCustomTemplate}
              onAddScreenTemplate={handleAddScreenTemplate}
              onAddSectionTemplate={handleAddSectionTemplate}
              onChangeComponentLayout={handleChangeComponentLayout}
              onDuplicateComponent={handleDuplicateComponentNode}
              onMoveComponent={handleMoveComponentToIndex}
              onPaletteDragEnd={() => setPaletteDragItem(null)}
              onPreviewDataChange={setPreviewData}
              onRemoveComponent={handleRemoveComponentNode}
              onRemoveScreen={handleRemoveScreenNode}
              onSelect={handleSelectNode}
              paletteDragItem={paletteDragItem}
            />
          ) : workspacePanel === 'runner' ? (
            <RunnerPanel
              form={form}
              state={runnerState}
              onChange={setRunnerState}
              onReset={() => setRunnerState(initialRunnerState())}
            />
          ) : (
            <OutputPanel form={form} />
          )}
        </section>

        <aside className="builder-sidebar" aria-label="Properties">
          <div className="builder-toolbox-tabs" role="tablist" aria-label="Properties panels">
            <button
              aria-selected={propertiesPanel === 'setup'}
              className={propertiesPanel === 'setup' ? 'is-active' : ''}
              role="tab"
              type="button"
              onClick={() => setPropertiesPanel('setup')}
            >
              Setup
            </button>
            <button
              aria-selected={propertiesPanel === 'properties'}
              className={propertiesPanel === 'properties' ? 'is-active' : ''}
              role="tab"
              type="button"
              onClick={() => setPropertiesPanel('properties')}
            >
              {selectedComponent ? 'Field' : 'Flow'}
            </button>
            <button
              aria-selected={propertiesPanel === 'audit'}
              className={propertiesPanel === 'audit' ? 'is-active' : ''}
              role="tab"
              type="button"
              onClick={() => setPropertiesPanel('audit')}
            >
              Audit
            </button>
          </div>

          {propertiesPanel === 'setup' && (
            <MetadataEditor
              availableFields={availableFields}
              form={form}
              onChange={handleMetadataChange}
            />
          )}

          {propertiesPanel === 'properties' && (
            selectedComponent ? (
              <InspectorPanel
                availableFields={availableFields}
                component={selectedComponent}
                onChange={handleComponentChange}
                onRemove={handleRemoveComponent}
              />
            ) : (
              <FlowEditorPanel
                availableFields={availableFields}
                canRemoveChapter={Boolean(selectedChapter)}
                canRemovePage={Boolean(
                  selectedChapter &&
                    (selectedChapter.pages.length > 1 ||
                      selectedChapter.type !== 'listLoop'),
                )}
                chapter={selectedChapter}
                page={selectedPage}
                onChapterChange={handleChapterChange}
                onPageChange={handlePageChange}
                onRemoveChapter={handleRemoveChapter}
                onRemovePage={handleRemovePage}
              />
            )
          )}

          {propertiesPanel === 'audit' && <AuditPanel baseline={baselineForm} form={form} />}
        </aside>
      </div>
    </main>
  );
}
