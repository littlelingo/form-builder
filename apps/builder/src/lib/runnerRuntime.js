import { evaluateRule } from '../../../../src/index.mjs';
import { componentMap, cloneValue, dataForStep, getPathValue, setFieldValueForStep, setPathValue } from './runnerFlow.js';

export function emptyRuntimeState() {
  return { components: {} };
}

function allEventHandlers(form) {
  const componentHandlers = (form.chapters || []).flatMap(chapter =>
    (chapter.pages || []).flatMap(page =>
      (page.components || []).flatMap(component => flattenComponentHandlers(component)),
    ),
  );
  return [...(form.eventHandlers || []), ...componentHandlers];
}

function flattenComponentHandlers(component) {
  return [
    ...(component.events || []).map(handler => ({
      ...handler,
      componentId: handler.componentId || component.id,
    })),
    ...(component.type === 'sectionGroup'
      ? (component.children || []).flatMap(child => flattenComponentHandlers(child))
      : []),
  ];
}

function resolveActionValue(action, context, data, runtimeState) {
  if (action.source) {
    if (action.source.startsWith('event.')) {
      return getPathValue(context, action.source.replace(/^event\./, ''));
    }
    if (action.source.startsWith('values.')) {
      return getPathValue(data, action.source.replace(/^values\./, ''));
    }
    if (action.source.startsWith('components.')) {
      return getPathValue(runtimeState.components, action.source.replace(/^components\./, ''));
    }
  }
  return action.value;
}

function applyComponentProperty(runtimeState, componentId, property, value) {
  return {
    ...runtimeState,
    components: {
      ...(runtimeState.components || {}),
      [componentId]: {
        ...(runtimeState.components?.[componentId] || {}),
        [property]: value,
      },
    },
  };
}

export function executeRunnerEvent({
  form,
  data = {},
  runtimeState = emptyRuntimeState(),
  eventLog = [],
  eventName,
  payload = {},
  step,
  depth = 0,
}) {
  const components = componentMap(form);
  let nextData = cloneValue(data || {});
  let nextRuntimeState = cloneValue(runtimeState || emptyRuntimeState());
  let nextEventLog = [...eventLog];
  const contextData = dataForStep(nextData, step);
  const context = {
    ...payload,
    event: eventName,
    values: contextData,
    formData: contextData,
    timestamp: new Date().toISOString(),
  };

  nextEventLog.push({
    type: 'event',
    event: eventName,
    componentId: payload.componentId,
    message: payload.componentId
      ? `${eventName} fired for ${payload.componentId}`
      : `${eventName} fired`,
  });

  if (depth > 6) {
    nextEventLog.push({
      type: 'warning',
      event: eventName,
      message: 'Nested event limit reached.',
    });
    return { data: nextData, runtimeState: nextRuntimeState, eventLog: nextEventLog };
  }

  allEventHandlers(form)
    .filter(handler => handler.event === eventName)
    .filter(handler => !handler.componentId || handler.componentId === payload.componentId)
    .forEach(handler => {
      try {
        if (handler.condition && !evaluateRule(handler.condition, { ...contextData, $event: context })) {
          return;
        }
      } catch (error) {
        nextEventLog.push({
          type: 'warning',
          event: eventName,
          handlerId: handler.id,
          message: `Handler condition failed: ${error.message}`,
        });
        return;
      }

      nextEventLog.push({
        type: 'handler',
        event: eventName,
        handlerId: handler.id,
        message: `Ran handler ${handler.id}`,
      });

      (handler.actions || []).forEach(action => {
        try {
          if (action.condition && !evaluateRule(action.condition, { ...contextData, $event: context })) {
            return;
          }
        } catch (error) {
          nextEventLog.push({
            type: 'warning',
            event: eventName,
            handlerId: handler.id,
            actionType: action.type,
            message: `Action condition failed: ${error.message}`,
          });
          return;
        }

        const value = resolveActionValue(action, context, nextData, nextRuntimeState);
        if (
          ['setComponentProperty', 'setVisibility', 'setRequired', 'setValidationMessage'].includes(action.type) &&
          action.componentId &&
          !components.has(action.componentId)
        ) {
          nextEventLog.push({
            type: 'warning',
            event: eventName,
            handlerId: handler.id,
            actionType: action.type,
            message: `Action target ${action.componentId} does not match a component.`,
          });
        }

        if (action.type === 'setValue') {
          if (step?.kind === 'listItemPage' && components.has(action.target)) {
            nextData = setFieldValueForStep(nextData, step, action.target, value);
          } else {
            nextData = setPathValue(nextData, action.target, value);
          }
        }

        if (action.type === 'setComponentProperty') {
          nextRuntimeState = applyComponentProperty(nextRuntimeState, action.componentId, action.property, value);
        }

        if (action.type === 'setVisibility') {
          nextRuntimeState = applyComponentProperty(
            nextRuntimeState,
            action.componentId,
            'visible',
            value === undefined ? true : Boolean(value),
          );
        }

        if (action.type === 'setRequired') {
          nextRuntimeState = applyComponentProperty(
            nextRuntimeState,
            action.componentId,
            'required',
            value === undefined ? true : Boolean(value),
          );
        }

        if (action.type === 'setValidationMessage') {
          nextRuntimeState = applyComponentProperty(
            nextRuntimeState,
            action.componentId,
            'validationMessage',
            action.message || value,
          );
        }

        nextEventLog.push({
          type: 'action',
          event: eventName,
          handlerId: handler.id,
          actionType: action.type,
          message: `Ran ${action.type}`,
        });

        if (action.type === 'emitEvent' && action.event) {
          const emitted = executeRunnerEvent({
            form,
            data: nextData,
            runtimeState: nextRuntimeState,
            eventLog: nextEventLog,
            eventName: action.event,
            payload: {
              ...payload,
              payload: action.payload === undefined ? value : action.payload,
            },
            step,
            depth: depth + 1,
          });
          nextData = emitted.data;
          nextRuntimeState = emitted.runtimeState;
          nextEventLog = emitted.eventLog;
        }
      });
    });

  return { data: nextData, runtimeState: nextRuntimeState, eventLog: nextEventLog };
}
