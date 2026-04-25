const RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

export const raw = code => ({ __rawCode: code });

export const isRaw = value =>
  value && typeof value === 'object' && typeof value.__rawCode === 'string';

export function toIdentifier(value, fallback = 'generated') {
  const source = String(value || fallback)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  const parts = source ? source.split(/\s+/) : [fallback];
  const [first = fallback, ...rest] = parts;
  let identifier =
    first.charAt(0).toLowerCase() +
    first.slice(1) +
    rest
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

  identifier = identifier.replace(/[^a-zA-Z0-9_$]/g, '');

  if (!identifier) identifier = fallback;
  if (/^[0-9]/.test(identifier)) identifier = `_${identifier}`;
  if (RESERVED_WORDS.has(identifier)) identifier = `${identifier}Value`;

  return identifier;
}

export function toKebab(value, fallback = 'generated') {
  return String(value || fallback)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function propertyKey(value) {
  const key = String(value);
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

export function indent(code, spaces = 2) {
  const prefix = ' '.repeat(spaces);
  return String(code)
    .split('\n')
    .map(line => (line ? `${prefix}${line}` : line))
    .join('\n');
}

export function jsValue(value, level = 0) {
  if (isRaw(value)) return value.__rawCode;
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const items = value
      .map(item => indent(jsValue(item, level + 1), (level + 1) * 2))
      .join(',\n');
    return `[\n${items},\n${' '.repeat(level * 2)}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => [key, jsValue(entryValue, level + 1)])
      .filter(([, rendered]) => rendered !== undefined);

    if (!entries.length) return '{}';

    const renderedEntries = entries
      .map(([key, rendered]) => {
        const property = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
          ? key
          : JSON.stringify(key);
        return `${' '.repeat((level + 1) * 2)}${property}: ${rendered}`;
      })
      .join(',\n');

    return `{\n${renderedEntries},\n${' '.repeat(level * 2)}}`;
  }

  throw new Error(`Unsupported JS value type: ${typeof value}`);
}

export function mergeSets(...sets) {
  return new Set(sets.flatMap(set => [...set]));
}

export function unique(values) {
  return [...new Set(values)];
}
