import type { CSSProperties } from 'react';

import type { AuthoringComponent, AuthoringRule, RuleOperator } from '../types';

interface ConditionEditorProps {
  label: string;
  condition?: AuthoringRule;
  availableFields: AuthoringComponent[];
  extraFields?: Array<{ id: string; label: string }>;
  onChange: (condition: AuthoringRule | undefined) => void;
}

type RuleMode = 'simple' | 'all' | 'any';
type RuleValueKind = 'none' | 'single' | 'list';

const operators: Array<{ value: RuleOperator; label: string; valueKind: RuleValueKind }> = [
  { value: 'equals', label: 'equals', valueKind: 'single' },
  { value: 'notEquals', label: 'does not equal', valueKind: 'single' },
  { value: 'in', label: 'is one of', valueKind: 'list' },
  { value: 'notIn', label: 'is not one of', valueKind: 'list' },
  { value: 'exists', label: 'has a value', valueKind: 'none' },
  { value: 'notExists', label: 'is blank', valueKind: 'none' },
  { value: 'greaterThan', label: 'is greater than', valueKind: 'single' },
  { value: 'greaterThanOrEqual', label: 'is greater than or equal to', valueKind: 'single' },
  { value: 'lessThan', label: 'is less than', valueKind: 'single' },
  { value: 'lessThanOrEqual', label: 'is less than or equal to', valueKind: 'single' },
];

function valueToInput(value: unknown) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function parseValue(value: string) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function parseListValue(value: string) {
  return value
    .split(/[,\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(parseValue);
}

function parseValueForOperator(value: string, operator: RuleOperator) {
  return ['in', 'notIn'].includes(operator) ? parseListValue(value) : parseValue(value);
}

function fieldOptions(
  availableFields: AuthoringComponent[],
  extraFields: Array<{ id: string; label: string }> = [],
) {
  return [
    ...extraFields,
    ...availableFields.map(component => ({
      id: component.id,
      label: `${component.label} (${component.id})`,
    })),
  ];
}

function createSimpleRule(
  availableFields: AuthoringComponent[],
  extraFields: Array<{ id: string; label: string }> = [],
): AuthoringRule {
  const fields = fieldOptions(availableFields, extraFields);
  return {
    field: fields[0]?.id || '',
    operator: 'equals',
    value: true,
  };
}

function createGroupRule(
  mode: Exclude<RuleMode, 'simple'>,
  availableFields: AuthoringComponent[],
  extraFields: Array<{ id: string; label: string }> = [],
) {
  return {
    [mode]: [createSimpleRule(availableFields, extraFields)],
  } as AuthoringRule;
}

function ruleMode(rule: AuthoringRule): RuleMode {
  if (Array.isArray(rule.all)) return 'all';
  if (Array.isArray(rule.any)) return 'any';
  return 'simple';
}

function ruleChildren(rule: AuthoringRule) {
  if (Array.isArray(rule.all)) return rule.all;
  if (Array.isArray(rule.any)) return rule.any;
  return [];
}

function operatorConfig(operator?: RuleOperator) {
  return operators.find(item => item.value === operator) || operators[0];
}

function SimpleRuleEditor({
  availableFields,
  extraFields = [],
  rule,
  onChange,
}: {
  availableFields: AuthoringComponent[];
  extraFields?: Array<{ id: string; label: string }>;
  rule: AuthoringRule;
  onChange: (rule: AuthoringRule) => void;
}) {
  const fields = fieldOptions(availableFields, extraFields);
  const field = rule.field || fields[0]?.id || '';
  const operator = (rule.operator || 'equals') as RuleOperator;
  const selectedOperator = operatorConfig(operator);
  const value = valueToInput(rule.value);

  function updateRule(patch: Partial<AuthoringRule>) {
    const nextOperator = (patch.operator || operator) as RuleOperator;
    const nextOperatorConfig = operatorConfig(nextOperator);
    const nextHasPatchedValue = Object.prototype.hasOwnProperty.call(patch, 'value');
    const next: AuthoringRule = {
      field,
      operator: nextOperator,
      ...patch,
    };

    if (nextOperatorConfig.valueKind === 'none') {
      delete next.value;
    } else if (!nextHasPatchedValue) {
      next.value = parseValueForOperator(value, nextOperator);
    }

    onChange(next);
  }

  return (
    <div className="builder-condition__grid">
      <label>
        <span>Field</span>
        <select
          className="usa-select"
          value={field}
          onChange={event => updateRule({ field: event.target.value })}
        >
          {fields.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Rule</span>
        <select
          className="usa-select"
          value={operator}
          onChange={event => updateRule({ operator: event.target.value as RuleOperator })}
        >
          {operators.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      {selectedOperator.valueKind !== 'none' && (
        <label>
          <span>Value</span>
          {selectedOperator.valueKind === 'list' && (
            <span className="usa-hint">Separate values with commas.</span>
          )}
          <input
            className="usa-input"
            value={value}
            onChange={event =>
              updateRule({ value: parseValueForOperator(event.target.value, operator) })
            }
          />
        </label>
      )}
    </div>
  );
}

function RuleEditor({
  availableFields,
  extraFields = [],
  depth = 0,
  onChange,
  onRemove,
  rule,
}: {
  availableFields: AuthoringComponent[];
  extraFields?: Array<{ id: string; label: string }>;
  depth?: number;
  onChange: (rule: AuthoringRule) => void;
  onRemove?: () => void;
  rule: AuthoringRule;
}) {
  const mode = ruleMode(rule);
  const children = ruleChildren(rule);

  function changeMode(nextMode: RuleMode) {
    if (nextMode === mode) return;
    if (nextMode === 'simple') {
      onChange(createSimpleRule(availableFields, extraFields));
      return;
    }
    onChange(createGroupRule(nextMode, availableFields, extraFields));
  }

  function updateChild(index: number, child: AuthoringRule) {
    const nextChildren = children.map((current, childIndex) =>
      childIndex === index ? child : current,
    );
    onChange(mode === 'all' ? { all: nextChildren } : { any: nextChildren });
  }

  function removeChild(index: number) {
    const nextChildren = children.filter((_, childIndex) => childIndex !== index);
    onChange(mode === 'all' ? { all: nextChildren } : { any: nextChildren });
  }

  function addChild() {
    const nextChildren = [...children, createSimpleRule(availableFields, extraFields)];
    onChange(mode === 'all' ? { all: nextChildren } : { any: nextChildren });
  }

  return (
    <div className="builder-rule-node" style={{ '--condition-depth': depth } as CSSProperties}>
      <div className="builder-rule-node__header">
        <label>
          <span>Condition type</span>
          <select
            className="usa-select"
            value={mode}
            onChange={event => changeMode(event.target.value as RuleMode)}
          >
            <option value="simple">Single rule</option>
            <option value="all">All of these rules</option>
            <option value="any">Any of these rules</option>
          </select>
        </label>
        {onRemove && (
          <button
            className="builder-text-button"
            type="button"
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>

      {mode === 'simple' ? (
        <SimpleRuleEditor
          availableFields={availableFields}
          extraFields={extraFields}
          rule={rule}
          onChange={onChange}
        />
      ) : (
        <div className="builder-rule-children">
          {children.map((child, index) => (
            <RuleEditor
              availableFields={availableFields}
              extraFields={extraFields}
              depth={depth + 1}
              key={`${mode}-${index}`}
              rule={child}
              onChange={nextChild => updateChild(index, nextChild)}
              onRemove={children.length > 1 ? () => removeChild(index) : undefined}
            />
          ))}
          <button className="builder-inline-action" type="button" onClick={addChild}>
            Add child rule
          </button>
        </div>
      )}
    </div>
  );
}

export function ConditionEditor({
  label,
  condition,
  availableFields,
  extraFields = [],
  onChange,
}: ConditionEditorProps) {
  const enabled = Boolean(condition);
  const controlId = `condition-${label.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  const hasFields = availableFields.length + extraFields.length > 0;

  return (
    <div className="builder-condition">
      <div className="usa-checkbox builder-checkbox">
        <input
          className="usa-checkbox__input"
          disabled={!hasFields}
          id={controlId}
          type="checkbox"
          checked={enabled}
          onChange={event =>
            onChange(event.target.checked ? createSimpleRule(availableFields, extraFields) : undefined)
          }
        />
        <label className="usa-checkbox__label" htmlFor={controlId}>
          {label}
        </label>
      </div>

      {!hasFields && (
        <p className="builder-condition__empty">Add a field before creating a condition.</p>
      )}

      {enabled && condition && hasFields && (
        <RuleEditor
          availableFields={availableFields}
          extraFields={extraFields}
          rule={condition}
          onChange={onChange}
        />
      )}
    </div>
  );
}
