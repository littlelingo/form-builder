import { toKebab } from '../compiler/utils.mjs';

const SEVERITY_RANK = {
  safe: 0,
  compatible: 1,
  migrationRequired: 2,
  breaking: 3,
};

function maxSeverity(current, next) {
  return SEVERITY_RANK[next] > SEVERITY_RANK[current] ? next : current;
}

function flattenFields(form) {
  const fields = new Map();
  const listLoops = new Map();

  (form.chapters || []).forEach(chapter => {
    if ((chapter.type || 'standard') === 'listLoop') {
      listLoops.set(chapter.id, {
        id: chapter.id,
        arrayPath: chapter.options?.arrayPath || toKebab(chapter.options?.nounPlural),
        nounSingular: chapter.options?.nounSingular,
        nounPlural: chapter.options?.nounPlural,
      });
    }

    (chapter.pages || []).forEach(page => {
      (page.components || []).forEach(component => {
        fields.set(component.id, {
          id: component.id,
          chapterId: chapter.id,
          pageId: page.id,
          type: component.type,
          label: component.label,
          required: !!component.required,
          requiredIf: component.requiredIf,
          dataPath: component.dataPath || component.id,
          options: (component.responseOptions || []).map(option => ({
            id: option.value ?? option.id,
            label: option.label,
          })),
        });
      });
    });
  });

  return { fields, listLoops };
}

function pushChange(changes, severity, code, message, meta = {}) {
  changes.push({ severity, code, message, ...meta });
}

export function diffAuthoringForms(previousForm, nextForm) {
  const previous = flattenFields(previousForm);
  const next = flattenFields(nextForm);
  const changes = [];
  let compatibility = 'safe';

  for (const [id, previousField] of previous.fields) {
    const nextField = next.fields.get(id);
    if (!nextField) {
      pushChange(
        changes,
        'migrationRequired',
        'FIELD_REMOVED',
        `Field "${id}" was removed.`,
        { fieldId: id },
      );
      compatibility = maxSeverity(compatibility, 'migrationRequired');
      continue;
    }

    if (previousField.type !== nextField.type) {
      pushChange(
        changes,
        'migrationRequired',
        'FIELD_TYPE_CHANGED',
        `Field "${id}" changed type from "${previousField.type}" to "${nextField.type}".`,
        { fieldId: id },
      );
      compatibility = maxSeverity(compatibility, 'migrationRequired');
    }

    if (previousField.dataPath !== nextField.dataPath) {
      pushChange(
        changes,
        'migrationRequired',
        'FIELD_DATA_PATH_CHANGED',
        `Field "${id}" changed data path from "${previousField.dataPath}" to "${nextField.dataPath}".`,
        { fieldId: id },
      );
      compatibility = maxSeverity(compatibility, 'migrationRequired');
    }

    if (!previousField.required && nextField.required) {
      pushChange(
        changes,
        'migrationRequired',
        'FIELD_BECAME_REQUIRED',
        `Field "${id}" changed from optional to required.`,
        { fieldId: id },
      );
      compatibility = maxSeverity(compatibility, 'migrationRequired');
    }

    const previousOptionIds = previousField.options.map(option => option.id);
    const nextOptionIds = nextField.options.map(option => option.id);
    const removedOptions = previousOptionIds.filter(idValue => !nextOptionIds.includes(idValue));
    if (removedOptions.length) {
      pushChange(
        changes,
        'migrationRequired',
        'FIELD_OPTIONS_REMOVED',
        `Field "${id}" removed option values: ${removedOptions.join(', ')}.`,
        { fieldId: id, removedOptions },
      );
      compatibility = maxSeverity(compatibility, 'migrationRequired');
    }

    if (previousField.label !== nextField.label) {
      pushChange(
        changes,
        'safe',
        'FIELD_LABEL_CHANGED',
        `Field "${id}" label changed.`,
        { fieldId: id },
      );
    }
  }

  for (const [id, nextField] of next.fields) {
    if (previous.fields.has(id)) continue;
    const severity = nextField.required ? 'migrationRequired' : 'compatible';
    pushChange(
      changes,
      severity,
      'FIELD_ADDED',
      `Field "${id}" was added${nextField.required ? ' as required' : ''}.`,
      { fieldId: id },
    );
    compatibility = maxSeverity(compatibility, severity);
  }

  for (const [id, previousLoop] of previous.listLoops) {
    const nextLoop = next.listLoops.get(id);
    if (!nextLoop) {
      pushChange(
        changes,
        'breaking',
        'LIST_LOOP_REMOVED',
        `List-loop chapter "${id}" was removed.`,
        { chapterId: id },
      );
      compatibility = maxSeverity(compatibility, 'breaking');
      continue;
    }
    if (previousLoop.arrayPath !== nextLoop.arrayPath) {
      pushChange(
        changes,
        'breaking',
        'LIST_LOOP_ARRAY_PATH_CHANGED',
        `List-loop "${id}" changed arrayPath from "${previousLoop.arrayPath}" to "${nextLoop.arrayPath}".`,
        { chapterId: id },
      );
      compatibility = maxSeverity(compatibility, 'breaking');
    }
  }

  return {
    compatibility,
    changes,
  };
}
