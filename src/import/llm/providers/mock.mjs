// Deterministic mock provider for tests + offline runs.

function titleCase(text) {
  if (!text) return '';
  const cleaned = String(text)
    .replace(/[._]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function inferType(field) {
  // Use AcroForm field name + heuristic label only. Neighbor text is too noisy
  // for type inference (siblings on the page leak in).
  const text = `${field.acroFormName || ''} ${field.heuristicLabel || ''}`.toLowerCase();
  if (/phone|telephone|cell|mobile/.test(text)) return { type: 'phone', confidence: 0.92 };
  if (/email/.test(text)) return { type: 'email', confidence: 0.92 };
  if (/ssn|social security/.test(text)) return { type: 'maskedInput', confidence: 0.9 };
  if (/(?:^|[^a-z])(date|dob|birth)(?:[^a-z]|$)/.test(text)) return { type: 'date', confidence: 0.9 };
  if (/zip|postal|street|city|state|country|\baddress\b/.test(text)) return { type: 'address', confidence: 0.85 };
  if (/yes\/no|do you|did you|are you|will you|have you/.test(text)) return { type: 'yesNo', confidence: 0.85 };
  if (/remarks?|comments?|explain|describe|tell us/.test(text)) return { type: 'textArea', confidence: 0.85 };
  if (field.acroFormType === 'checkbox') return { type: 'checkbox', confidence: 0.85 };
  if (field.acroFormType === 'radio') return { type: 'radioButton', confidence: 0.85 };
  if (field.acroFormType === 'dropdown') return { type: 'select', confidence: 0.85 };
  if (field.maxLength && field.maxLength > 200) return { type: 'textArea', confidence: 0.8 };
  return { type: field.heuristicType || 'textInput', confidence: 0.8 };
}

function hintFor(field, type) {
  if (type === 'maskedInput' && /ssn|social/.test(`${field.acroFormName || ''}`.toLowerCase())) {
    return 'Production hardening gap: use a masked SSN control before deployment.';
  }
  if (type === 'phone') return null;
  if (type === 'email') return null;
  if (field.neighborText && field.neighborText !== field.heuristicLabel) {
    const trimmed = field.neighborText.slice(0, 200);
    return trimmed === field.heuristicLabel ? null : trimmed;
  }
  return null;
}

function autocompleteFor(field, type) {
  if (type === 'email') return 'email';
  if (type === 'phone') return 'tel';
  const text = `${field.acroFormName || ''} ${field.heuristicLabel || ''}`.toLowerCase();
  if (/full name|first name|name/.test(text)) return 'name';
  return undefined;
}

export const mockProvider = {
  name: 'mock',
  defaultModel: 'mock-1',
  async isAvailable() {
    return true;
  },
  async enrich(payload) {
    const fields = (payload?.fields || []).map(field => {
      const { type, confidence } = inferType(field);
      const label = titleCase(field.heuristicLabel || field.acroFormName);
      const enriched = {
        fieldId: field.fieldId,
        label: label || 'Untitled field',
        type,
        classificationCertainty: confidence,
      };
      const hint = hintFor(field, type);
      if (hint) enriched.hint = hint;
      const autocomplete = autocompleteFor(field, type);
      if (autocomplete) enriched.autocomplete = autocomplete;
      return enriched;
    });
    return { fields };
  },
};
