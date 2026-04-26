function unionBbox(fields) {
  const boxes = fields.map(field => field.bbox).filter(Boolean);
  if (boxes.length === 0) return null;
  const page = boxes[0].page ?? 0;
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.w));
  const bottom = Math.max(...boxes.map(box => box.y + box.h));
  return {
    page,
    x: left,
    y: top,
    w: Math.max(0.01, right - left),
    h: Math.max(0.01, bottom - top),
  };
}

function unique(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = String(value || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fieldText(field) {
  return [field.name, field.closestLabel, field.neighborText]
    .filter(Boolean)
    .join(' ');
}

function compactLabel(label) {
  return String(label || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[:;,.]+$/g, '')
    .trim();
}

function cleanNumberedCandidate(label) {
  return compactLabel(label)
    .replace(/\s+\d{1,2}[A-Z]?$/i, '')
    .replace(/\s+(?:city|state|state\/province|country|zip|postal code|zip code\/postal code)$/i, '')
    .replace(/\s+(?:yes|no|army|navy|marine corps|air force|coast guard|space force|noaa|usphs|active duty|active|reserves|national guard|honorable|other than honorable|spouse|child|parent|guardian|custodian)$/i, '')
    .replace(/\s+\b[A-Z]\b$/i, '')
    .trim();
}

function titleCase(label) {
  return compactLabel(label)
    .toLowerCase()
    .replace(/\b[a-z]/g, char => char.toUpperCase())
    .replace(/'S\b/g, "'s")
    .replace(/\bVa\b/g, 'VA')
    .replace(/\bSsn\b/g, 'SSN')
    .replace(/\bNoaa\b/g, 'NOAA')
    .replace(/\bUsphs\b/g, 'USPHS');
}

const WEAK_LABELS = new Set([
  '(ssn)',
  '(mm-dd-yyyy)',
  '(if applicable)',
  '(include area code)',
  '(required)',
  '(check one)',
  'month',
  'day',
  'year',
  'city',
  'country',
  'state/province',
  'zip code/postal code',
  'yes',
  'no',
]);

function isWeakLabel(label) {
  const normalized = compactLabel(label).toLowerCase();
  return (
    WEAK_LABELS.has(normalized) ||
    /^section\s+[ivx]+/i.test(normalized) ||
    /^part\s+[ivx]+/i.test(normalized)
  );
}

function numberedLabelCandidates(text) {
  const candidates = [];
  const pattern = /\b(\d{1,2}[A-Z]?)\.\s*([A-Z][A-Za-z0-9/'&() -]{2,110})/g;
  let match;
  while ((match = pattern.exec(text))) {
    const label = cleanNumberedCandidate(`${match[1]}. ${match[2]}`);
    if (!/\b(INSTRUCTIONS?|NOTE|SECTION|PART)\b/i.test(label)) {
      candidates.push(label);
    }
  }
  return candidates;
}

function keywordScore(label, keywords) {
  if (!keywords?.length) return 0;
  const normalized = label.toLowerCase();
  return keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0);
}

function inferGroupLabel(fields, fallback, keywords = []) {
  const text = fields.map(fieldText).join(' ');
  const numbered = numberedLabelCandidates(text);
  const direct = fields
    .map(field => compactLabel(field.closestLabel))
    .filter(label => label && !isWeakLabel(label));
  const candidates = unique([...numbered, ...direct]);
  if (candidates.length === 0) return fallback;
  candidates.sort((a, b) => {
    const byKeyword = keywordScore(b, keywords) - keywordScore(a, keywords);
    if (byKeyword !== 0) return byKeyword;
    return a.length - b.length;
  });
  return titleCase(candidates[0]);
}

function addressFamily(field) {
  const name = field.name || '';
  if (/Mailing_?Address/i.test(name)) return 'mailing_address';
  const match = name.match(/\.(CurrentMailingAddress|NewAddress|Mailing_?Address|Address)(?:_|[A-Z]|\[)/i);
  return match?.[1]?.toLowerCase() || 'address';
}

function identityFamily(field) {
  const name = field.name || '';
  if (/Claimants?/i.test(name)) return 'claimant';
  if (/Veterans?/i.test(name)) return 'veteran';
  return 'identity';
}

function dateFamily(field) {
  const name = field.name || '';
  if (/DOB|birth/i.test(name)) return 'birth';
  if (/Date_?Signed|DateSigned/i.test(name)) return 'signed';
  if (/Date_Of_VA_Decision_Notice|#subform\[4\]\.Date_(?:Day|Year)/i.test(name)) return 'decision_notice';
  if (/Date_Of_Treatment/i.test(name)) return 'treatment';
  if (/Date_Last_VAF_21_22_Or_21_22A_Submitted|#subform\[6\]\.Date_(?:Day|Year)\[9\]/i.test(name)) return 'last_power_of_attorney_submission';
  return 'date';
}

function rowBucket(field) {
  const y = field.bbox?.y;
  return Number.isFinite(y) ? Math.round(y * 1000) : 'row';
}

function blockBucket(field, size = 0.3) {
  const y = field.bbox?.y;
  return Number.isFinite(y) ? Math.floor(y / size) : 'block';
}

function groupKey(field, kind) {
  const page = field.bbox?.page ?? 'x';
  const index = field.name?.match(/\[(\d+)\]$/)?.[1] ?? '0';
  const subform = field.name?.match(/#subform\[(\d+)\]/)?.[1] ?? 'form';
  if (kind === 'date') return `${kind}:${page}:${subform}:${dateFamily(field)}:${index}`;
  if (kind === 'address') return `${kind}:${page}:${subform}:${addressFamily(field)}:${blockBucket(field)}`;
  if (kind === 'name' || kind === 'ssn') return `${kind}:${page}:${subform}:${identityFamily(field)}:${index}`;
  if (kind === 'phone') return `${kind}:${page}:${subform}:${rowBucket(field)}`;
  return `${kind}:${page}:${subform}:${index}`;
}

function isDatePart(field) {
  const name = field.name || '';
  return /\.(?:(?:DOB|Date_?Signed|DateSigned|Date_Of_VA_Decision_Notice|Date_Of_Treatment|Date_Last_VAF_21_22_Or_21_22A_Submitted)_?)?(?:Month|Day|Year)\[\d+\]$/i.test(name) ||
    /\.Date_(?:Day|Year)\[\d+\]$/i.test(name);
}

function isSsnPart(field) {
  const name = field.name || '';
  const text = fieldText(field);
  const looksLikeSsnName = /(SSN|Social).*?(FirstThree|SecondTwo|LastFour)|SSN(FirstThree|SecondTwo|LastFour)/i.test(name);
  const ambiguousSsnPart = /(FirstThreeNumbers|SecondTwoNumbers|LastFourNumbers)\[\d+\]$/i.test(name) &&
    /\b(SSN|social security)\b/i.test(text);
  return looksLikeSsnName || ambiguousSsnPart;
}

function isSsnGroupCandidate(field) {
  const name = field.name || '';
  if (/(?:Address|ZIP|Postal)/i.test(name)) return false;
  return /(SSN(?:FirstThree|SecondTwo|LastFour)|FirstThreeNumbers|SecondTwoNumbers|LastFourNumbers)\[\d+\]$/i.test(name);
}

function isPhonePart(field) {
  const name = field.name || '';
  if (/(?:Mailing_Address|CurrentMailingAddress|NewAddress|Address).*ZIP/i.test(name)) return false;
  const phonePart = /(AreaCode|FirstThreeNumbers|SecondThreeNumbers|LastFourNumbers|International_Telephone_Number|International_Phone_Number|Telephone_Number_(?:FirstThree|SecondThree|LastFour)Numbers)/i.test(name);
  return phonePart && (/\b(phone|telephone|area code)\b/i.test(fieldText(field)) || /Telephone_Number|International_Phone_Number/i.test(name));
}

function isAddressPart(field) {
  const name = field.name || '';
  if (/\b(e-?mail|electronic correspondence)\b/i.test(field.closestLabel || '') && !/ZIP|Postal/i.test(name)) return false;
  const addressPart = /(Mailing_?Address|CurrentMailingAddress|NewAddress|Address_.*(City|Country|ZIP|State|Street|Apartment)|NumberAndStreet)/i.test(name);
  return addressPart && /\b(address|street|city|country|zip|postal|state|province)\b/i.test(fieldText(field));
}

function isNamePart(field) {
  const name = field.name || '';
  const namePart = /\.(?:(?:Veterans?|Claimants?)_?)?(?:First_Name|Middle_Initial1?|Last_Name|FirstName|MiddleInitial1?|LastName)\[\d+\]$/i.test(name);
  return namePart;
}

function makeConsolidatedField(fields, kind, patch = {}) {
  const ordered = [...fields].sort((a, b) => {
    const ax = a.bbox?.x ?? 0;
    const bx = b.bbox?.x ?? 0;
    return ax - bx;
  });
  const [first] = ordered;
  const name = `group:${kind}:${ordered.map(field => field.name).join('+')}`;
  return {
    ...first,
    ...patch,
    name,
    bbox: unionBbox(ordered),
    neighborText: unique(ordered.map(field => field.neighborText).filter(Boolean)).join(' '),
    sourceFieldNames: ordered.map(field => field.name),
  };
}

const RADIO_OPTION_GROUPS = {
  branch: ['Army', 'Navy', 'Marine Corps', 'Air Force', 'Coast Guard', 'Space Force', 'NOAA', 'USPHS'],
  component: ['Active', 'Active Duty', 'Reserves', 'National Guard'],
  character: ['Honorable', 'Other Than Honorable'],
  relationship: ['Spouse', 'Child', 'Parent', 'Guardian', 'Custodian'],
  yesNo: ['Yes', 'No'],
};

const RADIO_OPTION_PATTERN = /\b(YES|NO|ARMY|NAVY|MARINE CORPS|AIR FORCE|COAST GUARD|SPACE FORCE|NOAA|USPHS|ACTIVE DUTY|ACTIVE|RESERVES|NATIONAL GUARD|HONORABLE|OTHER THAN HONORABLE|SPOUSE|CHILD|PARENT|GUARDIAN|CUSTODIAN)\b/gi;

function extractRadioOptions(text) {
  const matches = new Set();
  for (const match of String(text || '').matchAll(RADIO_OPTION_PATTERN)) {
    matches.add(titleCase(match[1]));
  }
  return Object.values(RADIO_OPTION_GROUPS)
    .flat()
    .filter(option => matches.has(option));
}

function dominantOptionGroup(options) {
  if (options.some(option => RADIO_OPTION_GROUPS.character.includes(option))) return 'character';
  let best = null;
  let bestScore = 0;
  for (const [group, groupOptions] of Object.entries(RADIO_OPTION_GROUPS)) {
    const score = options.filter(option => groupOptions.includes(option)).length;
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

function radioKeywordsForGroup(group) {
  if (group === 'branch') return ['branch', 'service', 'branch', 'service', 'component'];
  if (group === 'component') return ['component', 'component', 'active', 'reserve', 'branch'];
  if (group === 'character') return ['character', 'discharge', 'character'];
  if (group === 'relationship') return ['relationship', 'veteran', 'relationship'];
  return [
    'branch',
    'component',
    'character',
    'relationship',
    'attending',
    'signature',
  ];
}

function optionLabel(field) {
  const label = compactLabel(field.closestLabel);
  if (label && !isWeakLabel(label) && !/^\d{1,2}[A-Z]?\./.test(label)) return titleCase(label);
  return extractRadioOptions(field.neighborText)[0] || null;
}

function consolidateRadioGroup(fields) {
  const directOptions = unique(fields.map(optionLabel).filter(Boolean));
  const combinedText = fields.map(fieldText).join(' ');
  const textOptions = extractRadioOptions(combinedText);
  const group = dominantOptionGroup(directOptions);
  const groupedOptions = group
    ? RADIO_OPTION_GROUPS[group].filter(option =>
        group === 'character' && /\bcharacter of discharge\b/i.test(combinedText)
          ? true
          : textOptions.includes(option) || directOptions.includes(option),
      )
    : unique([...directOptions, ...textOptions]);
  const options = groupedOptions.length > 0 ? groupedOptions : directOptions;
  const label = inferGroupLabel(fields, 'Radio option', radioKeywordsForGroup(group));
  const consolidated = makeConsolidatedField(fields, 'radio', {
    type: 'radio',
    closestLabel: label,
    options: options.length > 0 ? options : fields[0].options,
  });
  return {
    ...consolidated,
    name: fields[0].name,
  };
}

function collectGroups(fields, predicate, kind, minSize, patchForGroup) {
  const groups = new Map();
  fields.forEach((field, index) => {
    if (!predicate(field)) return;
    const key = groupKey(field, kind);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ field, index });
  });

  const result = [];
  for (const entries of groups.values()) {
    if (entries.length < minSize) continue;
    const groupFields = entries.map(entry => entry.field);
    const indexes = entries.map(entry => entry.index);
    result.push({
      indexes,
      field: makeConsolidatedField(groupFields, kind, patchForGroup(groupFields)),
    });
  }
  return result;
}

function collectSsnGroups(fields) {
  const groups = new Map();
  fields.forEach((field, index) => {
    if (!isSsnGroupCandidate(field)) return;
    const key = groupKey(field, 'ssn');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ field, index });
  });

  const result = [];
  for (const entries of groups.values()) {
    const groupFields = entries.map(entry => entry.field);
    const explicitFields = groupFields.filter(field =>
      /\bSSN|SocialSecurity|Social_Security/i.test(field.name || ''),
    );
    const selectedFields = explicitFields.length >= 3
      ? groupFields.filter(field =>
          explicitFields.includes(field) || /SecondTwoNumbers/i.test(field.name || ''),
        )
      : groupFields;
    const selectedNames = new Set(selectedFields.map(field => field.name));
    const selectedEntries = entries.filter(entry => selectedNames.has(entry.field.name));
    const names = groupFields.map(field => field.name || '').join(' ');
    const text = selectedFields.map(fieldText).join(' ');
    const hasSsnContext = /\b(SSN|social security)\b/i.test(text);
    const hasMiddleSsnPart = /SecondTwoNumbers|SSNSecondTwo/i.test(names);
    if (selectedEntries.length < 3 || (!hasSsnContext && !hasMiddleSsnPart)) continue;
    result.push({
      indexes: selectedEntries.map(entry => entry.index),
      field: makeConsolidatedField(selectedFields, 'ssn', {
        type: 'text',
        closestLabel: inferGroupLabel(selectedFields, 'Social Security number', ['social security', 'ssn']),
        maxLength: 11,
      }),
    });
  }
  return result;
}

export function consolidateFields(fields = []) {
  const replacements = [];

  const radioGroups = new Map();
  fields.forEach((field, index) => {
    if (field.type !== 'radio' || !field.name) return;
    if (!radioGroups.has(field.name)) radioGroups.set(field.name, []);
    radioGroups.get(field.name).push({ field, index });
  });
  for (const entries of radioGroups.values()) {
    if (entries.length < 2) continue;
    replacements.push({
      indexes: entries.map(entry => entry.index),
      field: consolidateRadioGroup(entries.map(entry => entry.field)),
    });
  }

  replacements.push(
    ...collectGroups(fields, isDatePart, 'date', 3, groupFields => ({
      type: 'text',
      closestLabel: inferGroupLabel(groupFields, 'Date', ['date', 'birth', 'signed', 'entered', 'separated']),
      maxLength: 20,
    })),
    ...collectSsnGroups(fields),
    ...collectGroups(fields, isSsnPart, 'ssn', 3, groupFields => ({
      type: 'text',
      closestLabel: inferGroupLabel(groupFields, 'Social Security number', ['social security', 'ssn']),
      maxLength: 11,
    })),
    ...collectGroups(fields, isPhonePart, 'phone', 3, groupFields => ({
      type: 'text',
      closestLabel: inferGroupLabel(groupFields, 'Telephone number', ['telephone', 'phone']),
      maxLength: 30,
    })),
    ...collectGroups(fields, isAddressPart, 'address', 4, groupFields => ({
      type: 'text',
      closestLabel: inferGroupLabel(groupFields, 'Mailing address', ['mailing address', 'address']),
      maxLength: 240,
    })),
    ...collectGroups(fields, isNamePart, 'name', 2, groupFields => ({
      type: 'text',
      closestLabel: inferGroupLabel(groupFields, 'Name', ['name']),
      maxLength: 80,
    })),
  );

  const claimed = new Set();
  const byFirstIndex = new Map();
  for (const replacement of replacements) {
    if (replacement.indexes.some(index => claimed.has(index))) continue;
    replacement.indexes.forEach(index => claimed.add(index));
    byFirstIndex.set(Math.min(...replacement.indexes), replacement.field);
  }

  const consolidated = [];
  fields.forEach((field, index) => {
    if (byFirstIndex.has(index)) {
      consolidated.push(byFirstIndex.get(index));
    }
    if (!claimed.has(index)) {
      consolidated.push(field);
    }
  });

  return consolidated;
}
