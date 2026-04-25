import type {
  AuthoringChapter,
  AuthoringComponent,
  AuthoringPage,
} from '../types';
import { ConditionEditor } from './ConditionEditor';

interface FlowEditorPanelProps {
  chapter?: AuthoringChapter;
  page?: AuthoringPage;
  availableFields: AuthoringComponent[];
  canRemoveChapter: boolean;
  canRemovePage: boolean;
  onChapterChange: (chapter: AuthoringChapter) => void;
  onPageChange: (page: AuthoringPage) => void;
  onRemoveChapter: () => void;
  onRemovePage: () => void;
}

function listLoopDefaults(chapter: AuthoringChapter): AuthoringChapter {
  return {
    ...chapter,
    type: 'listLoop',
    itemNameLabel: chapter.itemNameLabel || 'Item name',
    sectionIntro: chapter.sectionIntro || 'Add each item that applies.',
    options: {
      nounSingular: chapter.options?.nounSingular || 'item',
      nounPlural: chapter.options?.nounPlural || 'items',
      arrayPath: chapter.options?.arrayPath || chapter.id,
      required: chapter.options?.required || false,
      maxItems: chapter.options?.maxItems || 10,
    },
  };
}

export function FlowEditorPanel({
  chapter,
  page,
  availableFields,
  canRemoveChapter,
  canRemovePage,
  onChapterChange,
  onPageChange,
  onRemoveChapter,
  onRemovePage,
}: FlowEditorPanelProps) {
  if (!chapter || !page) {
    return (
      <section className="builder-card builder-card--compact" aria-labelledby="flow-editor-heading">
        <div className="builder-card__header">
          <p className="builder-eyebrow">Properties</p>
          <h2 id="flow-editor-heading">Nothing selected</h2>
        </div>
        <p className="builder-muted">Select a section or screen to edit its properties.</p>
      </section>
    );
  }

  const chapterType = chapter.type || 'standard';
  const isRepeatingGroup = chapterType === 'listLoop';

  return (
    <section className="builder-card builder-card--compact" aria-labelledby="flow-editor-heading">
      <div className="builder-card__header builder-card__header--split">
        <div>
          <p className="builder-eyebrow">Properties</p>
          <h2 id="flow-editor-heading">{isRepeatingGroup ? 'Repeating group' : 'Screen'}</h2>
        </div>
      </div>

      {isRepeatingGroup && (
        <div className="builder-form-section">
          <h3>Repeating group</h3>
          <label className="usa-label" htmlFor="chapter-title">
            Group title
          </label>
          <input
            className="usa-input"
            id="chapter-title"
            value={chapter.title}
            onChange={event => onChapterChange({ ...chapter, title: event.target.value })}
          />

        <div className="builder-two-column">
          <div>
            <label className="usa-label" htmlFor="chapter-id">
              Group ID
            </label>
            <input
              className="usa-input"
              id="chapter-id"
              value={chapter.id}
              onChange={event => onChapterChange({ ...chapter, id: event.target.value })}
            />
          </div>
          <div>
            <label className="usa-label" htmlFor="chapter-type">
              Group kind
            </label>
            <select
              className="usa-select"
              id="chapter-type"
              value={chapterType}
              onChange={event => {
                const type = event.target.value as AuthoringChapter['type'];
                onChapterChange(
                  type === 'listLoop'
                    ? listLoopDefaults(chapter)
                    : {
                        ...chapter,
                        type: 'standard',
                        options: undefined,
                        itemNameLabel: undefined,
                        sectionIntro: undefined,
                      },
                );
              }}
            >
              <option value="standard">Standard screen</option>
              <option value="listLoop">Repeatable group</option>
            </select>
          </div>
        </div>

        <ConditionEditor
          availableFields={availableFields}
          condition={chapter.condition}
          label="Show group only when"
          onChange={condition => onChapterChange({ ...chapter, condition })}
        />

        {isRepeatingGroup && (
          <div className="builder-list-loop-settings">
            <p className="builder-eyebrow">Repeatable group settings</p>
            <label className="usa-label" htmlFor="noun-singular">
              Singular noun
            </label>
            <input
              className="usa-input"
              id="noun-singular"
              value={chapter.options?.nounSingular || ''}
              onChange={event =>
                onChapterChange({
                  ...listLoopDefaults(chapter),
                  options: {
                    ...listLoopDefaults(chapter).options,
                    nounSingular: event.target.value,
                  },
                })
              }
            />

            <label className="usa-label" htmlFor="noun-plural">
              Plural noun
            </label>
            <input
              className="usa-input"
              id="noun-plural"
              value={chapter.options?.nounPlural || ''}
              onChange={event =>
                onChapterChange({
                  ...listLoopDefaults(chapter),
                  options: {
                    ...listLoopDefaults(chapter).options,
                    nounPlural: event.target.value,
                  },
                })
              }
            />

            <label className="usa-label" htmlFor="array-path">
              Saved array path
            </label>
            <input
              className="usa-input"
              id="array-path"
              value={chapter.options?.arrayPath || ''}
              onChange={event =>
                onChapterChange({
                  ...listLoopDefaults(chapter),
                  options: {
                    ...listLoopDefaults(chapter).options,
                    arrayPath: event.target.value,
                  },
                })
              }
            />

            <div className="builder-two-column">
              <div>
                <label className="usa-label" htmlFor="max-items">
                  Max items
                </label>
                <input
                  className="usa-input"
                  id="max-items"
                  min="1"
                  type="number"
                  value={chapter.options?.maxItems || 10}
                  onChange={event =>
                    onChapterChange({
                      ...listLoopDefaults(chapter),
                      options: {
                        ...listLoopDefaults(chapter).options,
                        maxItems: Number(event.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
              <div className="usa-checkbox builder-checkbox builder-checkbox--align-bottom">
                <input
                  className="usa-checkbox__input"
                  id="list-loop-required"
                  type="checkbox"
                  checked={Boolean(chapter.options?.required)}
                  onChange={event =>
                    onChapterChange({
                      ...listLoopDefaults(chapter),
                      options: {
                        ...listLoopDefaults(chapter).options,
                        required: event.target.checked,
                      },
                    })
                  }
                />
                <label className="usa-checkbox__label" htmlFor="list-loop-required">
                  Require at least one item
                </label>
              </div>
            </div>

            <label className="usa-label" htmlFor="item-name-label">
              Item name page label
            </label>
            <input
              className="usa-input"
              id="item-name-label"
              value={chapter.itemNameLabel || ''}
              onChange={event =>
                onChapterChange({
                  ...listLoopDefaults(chapter),
                  itemNameLabel: event.target.value,
                })
              }
            />

            <label className="usa-label" htmlFor="section-intro">
              Intro text
            </label>
            <textarea
              className="usa-textarea"
              id="section-intro"
              value={chapter.sectionIntro || ''}
              onChange={event =>
                onChapterChange({
                  ...listLoopDefaults(chapter),
                  sectionIntro: event.target.value,
                })
              }
            />
          </div>
        )}

        <button
          className="usa-button usa-button--secondary builder-danger-button"
          disabled={!canRemoveChapter}
          type="button"
          onClick={onRemoveChapter}
        >
          Remove group
        </button>
      </div>
      )}

      <div className="builder-form-section">
        <h3>Screen</h3>
        <label className="usa-label" htmlFor="page-title">
          Screen title
        </label>
        <input
          className="usa-input"
          id="page-title"
          value={page.title}
          onChange={event => onPageChange({ ...page, title: event.target.value })}
        />

        <div className="builder-two-column">
          <div>
            <label className="usa-label" htmlFor="page-id">
              Screen ID
            </label>
            <input
              className="usa-input"
              id="page-id"
              value={page.id}
              onChange={event => onPageChange({ ...page, id: event.target.value })}
            />
          </div>
          <div>
            <label className="usa-label" htmlFor="page-path">
              URL path
            </label>
            <input
              className="usa-input"
              id="page-path"
              value={page.path || ''}
              onChange={event => onPageChange({ ...page, path: event.target.value })}
            />
          </div>
        </div>

        <label className="usa-label" htmlFor="page-body">
          Body text
        </label>
        <textarea
          className="usa-textarea"
          id="page-body"
          value={page.bodyText || ''}
          onChange={event => onPageChange({ ...page, bodyText: event.target.value })}
        />

        <ConditionEditor
          availableFields={availableFields}
          condition={page.condition}
          label="Show screen only when"
          onChange={condition => onPageChange({ ...page, condition })}
        />

        <button
          className="usa-button usa-button--secondary builder-danger-button"
          disabled={!canRemovePage}
          type="button"
          onClick={onRemovePage}
        >
          Remove screen
        </button>
      </div>
    </section>
  );
}
