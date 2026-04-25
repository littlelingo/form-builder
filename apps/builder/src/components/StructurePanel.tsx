import { useState } from 'react';

import type { AuthoringForm, SelectedNode } from '../types';

type OutlineDropTarget =
  | { type: 'screen'; chapterId: string; pageId: string; index: number; edge: 'before' | 'after' }
  | { type: 'field'; chapterId: string; pageId: string; index: number; edge: 'before' | 'after' };

interface OutlineDragNode extends SelectedNode {
  type: 'screen' | 'field';
}

interface StructurePanelProps {
  form: AuthoringForm;
  selected: SelectedNode;
  onMoveComponentToIndex: (source: SelectedNode, target: SelectedNode, index: number) => void;
  onMoveScreenToIndex: (selected: SelectedNode, index: number) => void;
  onRemoveChapter: (chapterId: string) => void;
  onRemoveScreen: (selected: SelectedNode) => void;
  onSelect: (selected: SelectedNode) => void;
}

const outlineMime = 'application/x-va-outline-node';

function dragEdge(event: React.DragEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientY > bounds.top + bounds.height / 2 ? 'after' : 'before';
}

function dropIndex(index: number, edge: 'before' | 'after') {
  return edge === 'after' ? index + 1 : index;
}

function fieldCount(
  components: AuthoringForm['chapters'][number]['pages'][number]['components'],
): number {
  return components.reduce(
    (count, component) => count + 1 + fieldCount(component.children || []),
    0,
  );
}

function readOutlineDrag(event: React.DragEvent<HTMLElement>): OutlineDragNode | undefined {
  const raw = event.dataTransfer.getData(outlineMime);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as OutlineDragNode;
  } catch {
    return undefined;
  }
}

function writeOutlineDrag(event: React.DragEvent<HTMLElement>, node: OutlineDragNode) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(outlineMime, JSON.stringify(node));
  event.dataTransfer.setData('text/plain', node.componentId || node.pageId || node.chapterId);
}

export function StructurePanel({
  form,
  selected,
  onMoveComponentToIndex,
  onMoveScreenToIndex,
  onRemoveChapter,
  onRemoveScreen,
  onSelect,
}: StructurePanelProps) {
  const [dropTarget, setDropTarget] = useState<OutlineDropTarget | null>(null);

  function handleScreenDragOver(
    event: React.DragEvent<HTMLDivElement>,
    chapterId: string,
    pageId: string,
    index: number,
  ) {
    if (!event.dataTransfer.types.includes(outlineMime)) return;
    event.preventDefault();
    const edge = dragEdge(event);
    setDropTarget({ type: 'screen', chapterId, pageId, index: dropIndex(index, edge), edge });
  }

  function handleFieldDragOver(
    event: React.DragEvent<HTMLDivElement>,
    chapterId: string,
    pageId: string,
    index: number,
  ) {
    if (!event.dataTransfer.types.includes(outlineMime)) return;
    event.preventDefault();
    const edge = dragEdge(event);
    setDropTarget({ type: 'field', chapterId, pageId, index: dropIndex(index, edge), edge });
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const source = readOutlineDrag(event);
    const target = dropTarget;
    setDropTarget(null);
    if (!source || !target) return;

    if (source.type === 'screen' && target.type === 'screen') {
      onMoveScreenToIndex(source, target.index);
    }

    if (source.type === 'field' && target.type === 'field') {
      onMoveComponentToIndex(
        source,
        { chapterId: target.chapterId, pageId: target.pageId },
        target.index,
      );
    }
  }

  function dropClass(type: OutlineDropTarget['type'], chapterId: string, pageId: string, index: number) {
    if (!dropTarget || dropTarget.type !== type) return '';
    if (dropTarget.chapterId !== chapterId || dropTarget.pageId !== pageId) return '';
    const beforeIndex = dropTarget.edge === 'before' ? index : index + 1;
    if (dropTarget.index !== beforeIndex) return '';
    return dropTarget.edge === 'before' ? 'is-drop-before' : 'is-drop-after';
  }

  function renderFields(
    chapterId: string,
    pageId: string,
    components: AuthoringForm['chapters'][number]['pages'][number]['components'],
  ) {
    return (
      <div
        className="builder-tree__fields"
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropTarget(null);
          }
        }}
      >
        {components.length === 0 && (
          <div
            className="builder-outline-empty-drop"
            onDragOver={event => handleFieldDragOver(event, chapterId, pageId, 0)}
            onDrop={handleDrop}
          >
            Drop fields here
          </div>
        )}
        {components.map((component, componentIndex) => (
          <div className="builder-tree__field-group" key={component.id}>
            <div
              className={`builder-tree__row builder-tree__row--field ${dropClass(
                'field',
                chapterId,
                pageId,
                componentIndex,
              )}`}
              draggable
              onDragOver={event => handleFieldDragOver(event, chapterId, pageId, componentIndex)}
              onDragStart={event =>
                writeOutlineDrag(event, {
                  type: 'field',
                  chapterId,
                  pageId,
                  componentId: component.id,
                })
              }
              onDrop={handleDrop}
            >
              <span className="builder-tree-drag-handle" aria-hidden="true">
                ::
              </span>
              <button
                className={`builder-tree__field-button ${
                  selected.componentId === component.id ? 'is-selected' : ''
                }`}
                type="button"
                onClick={() =>
                  onSelect({
                    chapterId,
                    pageId,
                    componentId: component.id,
                  })
                }
              >
                <span>{component.label}</span>
                <small>
                  {component.type === 'sectionGroup'
                    ? `${fieldCount(component.children || [])} nested items`
                    : component.type}
                </small>
              </button>
            </div>
            {component.children && component.children.length > 0 && (
              <div className="builder-tree__nested-fields">
                {component.children.map(child => (
                  <div className="builder-tree__row builder-tree__row--field" key={child.id}>
                    <span className="builder-tree-drag-spacer" aria-hidden="true" />
                    <button
                      className={`builder-tree__field-button ${
                        selected.componentId === child.id ? 'is-selected' : ''
                      }`}
                      type="button"
                      onClick={() =>
                        onSelect({
                          chapterId,
                          pageId,
                          componentId: child.id,
                        })
                      }
                    >
                      <span>{child.label}</span>
                      <small>{child.type}</small>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="structure-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Form outline</p>
          <h2 id="structure-heading">Screens</h2>
        </div>
      </div>

      <div className="builder-tree" onDrop={handleDrop}>
        {form.chapters.length === 0 && (
          <p className="builder-muted">
            No screens yet. Drag a screen, screen section, or field from the Build toolbox to start.
          </p>
        )}

        {form.chapters.map((chapter, chapterIndex) => {
          if (chapter.type !== 'listLoop') {
            return chapter.pages.map(page => (
              <div className="builder-tree__page builder-tree__page--top" key={page.id}>
                <div
                  className={`builder-tree__row builder-tree__row--screen ${dropClass(
                    'screen',
                    chapter.id,
                    page.id,
                    chapterIndex,
                  )}`}
                  draggable
                  onDragOver={event =>
                    handleScreenDragOver(event, chapter.id, page.id, chapterIndex)
                  }
                  onDragStart={event =>
                    writeOutlineDrag(event, {
                      type: 'screen',
                      chapterId: chapter.id,
                      pageId: page.id,
                    })
                  }
                  onDrop={handleDrop}
                >
                  <span className="builder-tree-drag-handle" aria-hidden="true">
                    ::
                  </span>
                  <button
                    className={`builder-tree__page-button ${
                      selected.pageId === page.id && !selected.componentId ? 'is-selected' : ''
                    }`}
                    type="button"
                    onClick={() =>
                      onSelect({
                        chapterId: chapter.id,
                        pageId: page.id,
                        componentId: undefined,
                      })
                    }
                  >
                    {page.title}
                  </button>
                  <RemoveButton
                    label={page.title}
                    onRemove={() =>
                      onRemoveScreen({
                        chapterId: chapter.id,
                        pageId: page.id,
                      })
                    }
                  />
                </div>

                {renderFields(chapter.id, page.id, page.components)}
              </div>
            ));
          }

          return (
            <div className="builder-tree__chapter" key={chapter.id}>
              <div
                className={`builder-tree__row builder-tree__row--screen ${dropClass(
                  'screen',
                  chapter.id,
                  chapter.pages[0]?.id || '',
                  chapterIndex,
                )}`}
                draggable
                onDragOver={event =>
                  handleScreenDragOver(event, chapter.id, chapter.pages[0]?.id, chapterIndex)
                }
                onDragStart={event =>
                  writeOutlineDrag(event, {
                    type: 'screen',
                    chapterId: chapter.id,
                    pageId: chapter.pages[0]?.id || '',
                  })
                }
                onDrop={handleDrop}
              >
                <span className="builder-tree-drag-handle" aria-hidden="true">
                  ::
                </span>
                <button
                  className={`builder-tree__chapter-button ${
                    selected.chapterId === chapter.id ? 'is-selected' : ''
                  }`}
                  type="button"
                  onClick={() =>
                    onSelect({
                      chapterId: chapter.id,
                    pageId: chapter.pages[0]?.id || '',
                      componentId: undefined,
                    })
                  }
                >
                  <span>{chapter.title}</span>
                  <small>Repeating item group</small>
                </button>
                <RemoveButton label={chapter.title} onRemove={() => onRemoveChapter(chapter.id)} />
              </div>

              {chapter.pages.map((page, pageIndex) => (
                <div className="builder-tree__page" key={page.id}>
                  <div
                    className={`builder-tree__row builder-tree__row--screen ${dropClass(
                      'screen',
                      chapter.id,
                      page.id,
                      pageIndex,
                    )}`}
                    draggable
                    onDragOver={event =>
                      handleScreenDragOver(event, chapter.id, page.id, pageIndex)
                    }
                    onDragStart={event =>
                      writeOutlineDrag(event, {
                        type: 'screen',
                        chapterId: chapter.id,
                        pageId: page.id,
                      })
                    }
                    onDrop={handleDrop}
                  >
                    <span className="builder-tree-drag-handle" aria-hidden="true">
                      ::
                    </span>
                    <button
                      className={`builder-tree__page-button ${
                        selected.pageId === page.id ? 'is-selected' : ''
                      }`}
                      type="button"
                      onClick={() =>
                        onSelect({
                          chapterId: chapter.id,
                          pageId: page.id,
                          componentId: undefined,
                        })
                      }
                    >
                      {page.title}
                    </button>
                    <RemoveButton
                      label={page.title}
                      onRemove={() =>
                        onRemoveScreen({
                          chapterId: chapter.id,
                          pageId: page.id,
                        })
                      }
                    />
                  </div>

                  {renderFields(chapter.id, page.id, page.components)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      aria-label={`Remove ${label}`}
      className="builder-tree-remove-button"
      title="Remove"
      type="button"
      onClick={onRemove}
    >
      x
    </button>
  );
}
