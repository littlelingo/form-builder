function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function computeAcroformSignal(field) {
  if (!field) return 0;
  if (field.staticSource === 'text-layout' || field.provenanceOrigin === 'pdf-static-region') {
    return field.bbox ? 0.35 : 0.2;
  }
  const hasName = !!field.name;
  const hasType = !!field.type && field.type !== 'unknown';
  const hasBbox = !!field.bbox;
  if (hasName && hasType && hasBbox) return 1.0;
  if (hasName && hasType) return 0.7;
  if (hasName) return 0.5;
  return 0.2;
}

export function computeLabelDistance(field) {
  if (!field?.closestLabel) return 0;
  const length = field.closestLabel.length;
  if (length === 0) return 0;
  if (length < 3) return 0.4;
  if (length < 80) return 0.85;
  return 0.6;
}

export function computeValidationMatch(field, componentType) {
  let score = 0;
  if (field?.required) score += 0.4;
  if (field?.maxLength) score += 0.3;
  if (componentType === 'date' && /\b(date|dob|birth)\b/i.test(field?.name || '')) score += 0.3;
  if (componentType === 'email') score += 0.3;
  if (componentType === 'phone') score += 0.3;
  return clamp01(score);
}

export function computeConfidence({
  acroformSignal = 0,
  labelDistance = 0,
  classificationCertainty = 0,
  corpusSimilarity = 0,
  validationMatch = 0,
}) {
  const weighted =
    0.30 * acroformSignal +
    0.20 * labelDistance +
    0.20 * classificationCertainty +
    0.20 * corpusSimilarity +
    0.10 * validationMatch;
  return clamp01(weighted);
}

export function band(confidence) {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}
