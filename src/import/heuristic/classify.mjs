const LABEL_HINT_PATTERNS = [
  { test: /\b(email|e-mail)\b/i, type: 'email' },
  { test: /\b(phone|telephone|cell|mobile|tel\.)\b/i, type: 'phone' },
  { test: /\bdate(?: of birth| signed| started| ended)?\b/i, type: 'date' },
  { test: /\b(birth|dob)\b/i, type: 'date' },
  { test: /\b(ssn|social security)\b/i, type: 'maskedInput' },
  { test: /\b(zip|postal code|state|country|address line|street|city)\b/i, type: 'address' },
  { test: /\b(amount|monthly income|dollars?|payment|cost)\b/i, type: 'textInput' },
  { test: /\b(yes\/no|do you|did you|are you|will you|have you)\b/i, type: 'yesNo' },
  { test: /\b(comments?|remarks?|explain|describe|tell us|reason)\b/i, type: 'textArea' },
];

const FIELDNAME_HINT_PATTERNS = [
  { test: /email/i, type: 'email' },
  { test: /phone|telephone|cell/i, type: 'phone' },
  { test: /(?:^|[_-])date(?:[_-]|$)|dob|birth/i, type: 'date' },
  { test: /ssn|social/i, type: 'maskedInput' },
  { test: /zip|postal|street|address|city|state|country/i, type: 'address' },
  { test: /yesno|yes_no/i, type: 'yesNo' },
  { test: /remarks?|comments?|explain|describe/i, type: 'textArea' },
];

function inferTypeFromText(label, fieldName) {
  if (label) {
    for (const rule of LABEL_HINT_PATTERNS) {
      if (rule.test.test(label)) return rule.type;
    }
  }
  if (fieldName) {
    for (const rule of FIELDNAME_HINT_PATTERNS) {
      if (rule.test.test(fieldName)) return rule.type;
    }
  }
  return null;
}

function inferFromAcroFormType(acroFormType) {
  switch (acroFormType) {
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radioButton';
    case 'dropdown':
    case 'optionList':
      return 'select';
    case 'text':
      return 'textInput';
    default:
      return 'textInput';
  }
}

export function classifyComponent(field) {
  const fromText = inferTypeFromText(field.closestLabel || '', field.name || '');
  const fromAcro = inferFromAcroFormType(field.type);

  const isMultiLineText = field.maxLength && field.maxLength > 200;

  let type;
  let heuristicConfidence;

  if (fromText) {
    type = fromText;
    heuristicConfidence = 0.7;
  } else if (isMultiLineText && fromAcro === 'textInput') {
    type = 'textArea';
    heuristicConfidence = 0.6;
  } else {
    type = fromAcro;
    heuristicConfidence = fromAcro === 'textInput' ? 0.4 : 0.55;
  }

  if (field.type === 'checkbox' && type !== 'checkbox') {
    type = 'checkbox';
    heuristicConfidence = 0.5;
  }
  if (field.type === 'radio' && type !== 'radioButton') {
    type = 'radioButton';
    heuristicConfidence = 0.55;
  }

  return {
    componentType: type,
    heuristicConfidence,
  };
}
