import type {
  AuthoringComponent,
  AuthoringEventAction,
  AuthoringEventHandler,
  AuthoringEventName,
} from '../types';
import { ConditionEditor } from './ConditionEditor';
import { InspectorSection } from './InspectorSection';

const eventOptions: Array<{ value: AuthoringEventName; label: string }> = [
  { value: 'field.change', label: 'Field changes' },
  { value: 'field.focus', label: 'Field focused' },
  { value: 'field.blur', label: 'Field blurred' },
  { value: 'page.enter', label: 'Page entered' },
  { value: 'form.beforeSubmit', label: 'Before submit' },
  { value: 'form.submit', label: 'Form submit' },
];

const actionOptions: Array<{ value: AuthoringEventAction['type']; label: string }> = [
  { value: 'setValue', label: 'Set answer value' },
  { value: 'setComponentProperty', label: 'Set component property' },
  { value: 'setVisibility', label: 'Set visibility' },
  { value: 'setRequired', label: 'Set required' },
  { value: 'setValidationMessage', label: 'Set validation message' },
  { value: 'emitEvent', label: 'Emit event' },
];

interface EventHandlersEditorProps {
  availableFields: AuthoringComponent[];
  handlers?: AuthoringEventHandler[];
  scopedComponentId?: string;
  title?: string;
  onChange: (handlers: AuthoringEventHandler[]) => void;
}

function uniqueHandlerId(handlers: AuthoringEventHandler[]) {
  let index = handlers.length + 1;
  let id = `eventHandler${index}`;
  while (handlers.some(handler => handler.id === id)) {
    index += 1;
    id = `eventHandler${index}`;
  }
  return id;
}

function defaultAction(): AuthoringEventAction {
  return {
    type: 'setValue',
    target: '',
    source: 'event.value',
  };
}

function defaultHandler(handlers: AuthoringEventHandler[]): AuthoringEventHandler {
  return {
    id: uniqueHandlerId(handlers),
    event: 'field.change',
    actions: [defaultAction()],
  };
}

function booleanSelectValue(value: unknown) {
  if (value === false || value === 'false') return 'false';
  return 'true';
}

export function EventHandlersEditor({
  availableFields,
  handlers = [],
  scopedComponentId,
  title = 'Events',
  onChange,
}: EventHandlersEditorProps) {
  const displayedEventOptions = scopedComponentId
    ? eventOptions.filter(option => option.value.startsWith('field.'))
    : eventOptions;

  function updateHandler(index: number, patch: Partial<AuthoringEventHandler>) {
    onChange(handlers.map((handler, handlerIndex) => (
      handlerIndex === index ? { ...handler, ...patch } : handler
    )));
  }

  function updateAction(handlerIndex: number, actionIndex: number, patch: Partial<AuthoringEventAction>) {
    const handler = handlers[handlerIndex];
    const actions = handler.actions || [];
    updateHandler(handlerIndex, {
      actions: actions.map((action, index) => (
        index === actionIndex ? { ...action, ...patch } : action
      )),
    });
  }

  function addHandler() {
    onChange([...handlers, defaultHandler(handlers)]);
  }

  function removeHandler(index: number) {
    onChange(handlers.filter((_, handlerIndex) => handlerIndex !== index));
  }

  function addAction(handlerIndex: number) {
    const handler = handlers[handlerIndex];
    updateHandler(handlerIndex, {
      actions: [...(handler.actions || []), defaultAction()],
    });
  }

  function removeAction(handlerIndex: number, actionIndex: number) {
    const handler = handlers[handlerIndex];
    updateHandler(handlerIndex, {
      actions: (handler.actions || []).filter((_, index) => index !== actionIndex),
    });
  }

  return (
    <InspectorSection eyebrow="Automation" title={title}>
      <div className="builder-card__header builder-card__header--split">
        <div>
          <h3>{title}</h3>
        </div>
        <button className="usa-button usa-button--secondary" type="button" onClick={addHandler}>
          Add handler
        </button>
      </div>

      {handlers.length === 0 && (
        <p className="usa-prose">No event handlers have been added.</p>
      )}

      {handlers.map((handler, handlerIndex) => (
        <div className="builder-mapping-row" key={`${handler.id}-${handlerIndex}`}>
          <div className="builder-two-column">
            <div>
              <label className="usa-label" htmlFor={`event-id-${handlerIndex}`}>
                Handler ID
              </label>
              <input
                className="usa-input"
                id={`event-id-${handlerIndex}`}
                value={handler.id}
                onChange={event => updateHandler(handlerIndex, { id: event.target.value })}
              />
            </div>
            <div>
              <label className="usa-label" htmlFor={`event-name-${handlerIndex}`}>
                Trigger
              </label>
              <select
                className="usa-select"
                id={`event-name-${handlerIndex}`}
                value={handler.event}
                onChange={event =>
                  updateHandler(handlerIndex, { event: event.target.value as AuthoringEventName })
                }
              >
                {displayedEventOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!scopedComponentId && handler.event.startsWith('field.') && (
            <div>
              <label className="usa-label" htmlFor={`event-component-${handlerIndex}`}>
                Source component
              </label>
              <select
                className="usa-select"
                id={`event-component-${handlerIndex}`}
                value={handler.componentId || ''}
                onChange={event =>
                  updateHandler(handlerIndex, { componentId: event.target.value || undefined })
                }
              >
                <option value="">Any component</option>
                {availableFields.map(field => (
                  <option key={field.id} value={field.id}>
                    {field.label} ({field.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <ConditionEditor
            availableFields={availableFields}
            condition={handler.condition}
            label="Run only when"
            onChange={condition => updateHandler(handlerIndex, { condition })}
          />

          <div className="builder-form-section">
            <div className="builder-card__header builder-card__header--split">
              <h4>Actions</h4>
              <button
                className="usa-button usa-button--secondary"
                type="button"
                onClick={() => addAction(handlerIndex)}
              >
                Add action
              </button>
            </div>

            {(handler.actions || []).map((action, actionIndex) => (
              <div className="builder-mapping-row" key={`${handler.id}-action-${actionIndex}`}>
                <div className="builder-two-column">
                  <div>
                    <label className="usa-label" htmlFor={`action-type-${handlerIndex}-${actionIndex}`}>
                      Action
                    </label>
                    <select
                      className="usa-select"
                      id={`action-type-${handlerIndex}-${actionIndex}`}
                      value={action.type}
                      onChange={event =>
                        updateAction(handlerIndex, actionIndex, {
                          type: event.target.value as AuthoringEventAction['type'],
                        })
                      }
                    >
                      {actionOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {action.type === 'setValue' && (
                    <div>
                      <label className="usa-label" htmlFor={`action-target-${handlerIndex}-${actionIndex}`}>
                        Target value
                      </label>
                      <select
                        className="usa-select"
                        id={`action-target-${handlerIndex}-${actionIndex}`}
                        value={action.target || ''}
                        onChange={event =>
                          updateAction(handlerIndex, actionIndex, { target: event.target.value })
                        }
                      >
                        <option value="">Select target</option>
                        {availableFields.map(field => (
                          <option key={field.id} value={field.id}>
                            {field.label} ({field.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {['setComponentProperty', 'setVisibility', 'setRequired', 'setValidationMessage'].includes(action.type) && (
                    <div>
                      <label className="usa-label" htmlFor={`action-component-${handlerIndex}-${actionIndex}`}>
                        Target component
                      </label>
                      <select
                        className="usa-select"
                        id={`action-component-${handlerIndex}-${actionIndex}`}
                        value={action.componentId || ''}
                        onChange={event =>
                          updateAction(handlerIndex, actionIndex, { componentId: event.target.value })
                        }
                      >
                        <option value="">Select component</option>
                        {availableFields.map(field => (
                          <option key={field.id} value={field.id}>
                            {field.label} ({field.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {action.type === 'setComponentProperty' && (
                  <div className="builder-two-column">
                    <div>
                      <label className="usa-label" htmlFor={`action-property-${handlerIndex}-${actionIndex}`}>
                        Property
                      </label>
                      <input
                        className="usa-input"
                        id={`action-property-${handlerIndex}-${actionIndex}`}
                        placeholder="label"
                        value={action.property || ''}
                        onChange={event =>
                          updateAction(handlerIndex, actionIndex, { property: event.target.value })
                        }
                      />
                    </div>
                    <SourceInput
                      action={action}
                      handlerIndex={handlerIndex}
                      actionIndex={actionIndex}
                      onChange={patch => updateAction(handlerIndex, actionIndex, patch)}
                    />
                  </div>
                )}

                {action.type === 'setValue' && (
                  <SourceInput
                    action={action}
                    handlerIndex={handlerIndex}
                    actionIndex={actionIndex}
                    onChange={patch => updateAction(handlerIndex, actionIndex, patch)}
                  />
                )}

                {['setVisibility', 'setRequired'].includes(action.type) && (
                  <div>
                    <label className="usa-label" htmlFor={`action-bool-${handlerIndex}-${actionIndex}`}>
                      Value
                    </label>
                    <select
                      className="usa-select"
                      id={`action-bool-${handlerIndex}-${actionIndex}`}
                      value={booleanSelectValue(action.value)}
                      onChange={event =>
                        updateAction(handlerIndex, actionIndex, {
                          value: event.target.value === 'true',
                          source: undefined,
                        })
                      }
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </div>
                )}

                {action.type === 'setValidationMessage' && (
                  <div>
                    <label className="usa-label" htmlFor={`action-message-${handlerIndex}-${actionIndex}`}>
                      Message
                    </label>
                    <input
                      className="usa-input"
                      id={`action-message-${handlerIndex}-${actionIndex}`}
                      value={action.message || ''}
                      onChange={event =>
                        updateAction(handlerIndex, actionIndex, { message: event.target.value })
                      }
                    />
                  </div>
                )}

                {action.type === 'emitEvent' && (
                  <div>
                    <label className="usa-label" htmlFor={`action-event-${handlerIndex}-${actionIndex}`}>
                      Event name
                    </label>
                    <input
                      className="usa-input"
                      id={`action-event-${handlerIndex}-${actionIndex}`}
                      placeholder="custom.event"
                      value={action.event || ''}
                      onChange={event =>
                        updateAction(handlerIndex, actionIndex, { event: event.target.value })
                      }
                    />
                  </div>
                )}

                <button
                  className="usa-button usa-button--unstyled builder-remove-link"
                  type="button"
                  onClick={() => removeAction(handlerIndex, actionIndex)}
                >
                  Remove action
                </button>
              </div>
            ))}
          </div>

          <button
            className="usa-button usa-button--unstyled builder-remove-link"
            type="button"
            onClick={() => removeHandler(handlerIndex)}
          >
            Remove handler
          </button>
        </div>
      ))}
    </InspectorSection>
  );
}

function SourceInput({
  action,
  handlerIndex,
  actionIndex,
  onChange,
}: {
  action: AuthoringEventAction;
  handlerIndex: number;
  actionIndex: number;
  onChange: (patch: Partial<AuthoringEventAction>) => void;
}) {
  return (
    <div className="builder-two-column">
      <div>
        <label className="usa-label" htmlFor={`action-source-${handlerIndex}-${actionIndex}`}>
          Source path
        </label>
        <input
          className="usa-input"
          id={`action-source-${handlerIndex}-${actionIndex}`}
          placeholder="event.value"
          value={action.source || ''}
          onChange={event => onChange({ source: event.target.value || undefined })}
        />
      </div>
      <div>
        <label className="usa-label" htmlFor={`action-value-${handlerIndex}-${actionIndex}`}>
          Literal value
        </label>
        <input
          className="usa-input"
          id={`action-value-${handlerIndex}-${actionIndex}`}
          value={typeof action.value === 'string' ? action.value : ''}
          onChange={event => onChange({ value: event.target.value })}
        />
      </div>
    </div>
  );
}
