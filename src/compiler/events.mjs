export const generatedEventHelperCode = `const authoringRuntimeGetPathValue = (data, path) => {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .reduce((current, segment) => {
      if (current === null || current === undefined) return undefined;
      return current[segment];
    }, data);
};

const authoringRuntimeSetPathValue = (data, path, value) => {
  const segments = String(path).split('.').filter(Boolean);
  if (!segments.length) return data;
  let current = data;
  segments.slice(0, -1).forEach(segment => {
    if (!current[segment] || typeof current[segment] !== 'object') current[segment] = {};
    current = current[segment];
  });
  current[segments[segments.length - 1]] = value;
  return data;
};

const cloneAuthoringRuntimeValue = value => JSON.parse(JSON.stringify(value || {}));

const createAuthoringRuntime = ({ components = {}, eventHandlers = [] } = {}) => {
  const listeners = {};
  const componentState = cloneAuthoringRuntimeValue(components);
  let values = {};

  const api = {
    subscribe(eventName, handler) {
      listeners[eventName] = listeners[eventName] || new Set();
      listeners[eventName].add(handler);
      return () => listeners[eventName]?.delete(handler);
    },
    getValue(path) {
      return authoringRuntimeGetPathValue(values, path);
    },
    getValues() {
      return cloneAuthoringRuntimeValue(values);
    },
    getComponent(componentId) {
      return componentState[componentId] ? { ...componentState[componentId] } : undefined;
    },
    getComponentProperty(componentId, propertyName) {
      return componentState[componentId]?.[propertyName];
    },
    setValue(path, value) {
      values = authoringRuntimeSetPathValue({ ...values }, path, value);
      return values;
    },
    setComponentProperty(componentId, propertyName, value) {
      if (!componentState[componentId]) componentState[componentId] = { id: componentId };
      componentState[componentId] = {
        ...componentState[componentId],
        [propertyName]: value,
      };
      return componentState[componentId];
    },
    emit(eventName, payload = {}) {
      const componentId = payload.componentId;
      if (eventName === 'field.change' && componentId) {
        api.setValue(componentId, payload.value);
      }

      const context = {
        ...payload,
        event: eventName,
        values,
        formData: payload.formData || values,
        component: componentId ? componentState[componentId] : payload.component,
        components: componentState,
        timestamp: new Date().toISOString(),
      };

      eventHandlers
        .filter(handler => handler.event === eventName)
        .filter(handler => !handler.componentId || handler.componentId === componentId)
        .filter(handler => !handler.condition || evaluateAuthoringRule(handler.condition, {
          ...values,
          $event: context,
        }))
        .forEach(handler => {
          (handler.actions || []).forEach(action => api.runAction(action, context));
        });

      (listeners[eventName] || []).forEach(listener => listener(context, api));
      (listeners['*'] || []).forEach(listener => listener(context, api));
      return context;
    },
    runAction(action, context = {}) {
      if (action.condition && !evaluateAuthoringRule(action.condition, {
        ...values,
        $event: context,
      })) {
        return undefined;
      }

      const value = resolveAuthoringRuntimeActionValue(action, context);
      switch (action.type) {
        case 'setValue':
          return api.setValue(action.target, value);
        case 'setComponentProperty':
          return api.setComponentProperty(action.componentId, action.property, value);
        case 'setVisibility':
          return api.setComponentProperty(action.componentId, 'visible', value === undefined ? true : !!value);
        case 'setRequired':
          return api.setComponentProperty(action.componentId, 'required', value === undefined ? true : !!value);
        case 'setValidationMessage':
          return api.setComponentProperty(action.componentId, 'validationMessage', action.message || value);
        case 'emitEvent':
          return api.emit(action.event, {
            ...context,
            payload: action.payload === undefined ? value : action.payload,
          });
        default:
          return undefined;
      }
    },
  };

  const resolveAuthoringRuntimeActionValue = (action, context) => {
    if (action.source) {
      if (action.source.startsWith('event.')) {
        return authoringRuntimeGetPathValue(context, action.source.replace(/^event\\./, ''));
      }
      if (action.source.startsWith('values.')) {
        return authoringRuntimeGetPathValue(values, action.source.replace(/^values\\./, ''));
      }
      if (action.source.startsWith('components.')) {
        return authoringRuntimeGetPathValue(componentState, action.source.replace(/^components\\./, ''));
      }
    }
    return action.value;
  };

  return api;
};

const withAuthoringFieldEvents = (componentId, uiSchema = {}) => {
  const originalOptions = uiSchema['ui:options'] || {};
  const previousValues = {};
  return {
    ...uiSchema,
    'ui:options': {
      ...originalOptions,
      onChange: (value, formData) => {
        const actualValue = value?.target ? value.target.value : value;
        const result = originalOptions.onChange?.(value, formData);
        authoringRuntime.emit('field.change', {
          componentId,
          value: actualValue,
          previousValue: previousValues[componentId],
          formData,
        });
        previousValues[componentId] = actualValue;
        return result;
      },
      onFocus: (event, formData) => {
        const result = originalOptions.onFocus?.(event, formData);
        authoringRuntime.emit('field.focus', {
          componentId,
          value: event?.target?.value,
          formData,
        });
        return result;
      },
      onBlur: (event, formData) => {
        const result = originalOptions.onBlur?.(event, formData);
        authoringRuntime.emit('field.blur', {
          componentId,
          value: event?.target?.value,
          formData,
        });
        return result;
      },
    },
  };
};`;
