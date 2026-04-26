export const PATTERN_TAXONOMY_VERSION = '2026.04-xfa-normalized';
const MAX_UNMATCHED_SUMMARY_TOKENS = 20;

const IMPORTER_NOISE_PATTERNS = [
  /\binferred from visible pdf text because no usable fillable fields were detected\b/gi,
  /\binferred from visible pdf text\b/gi,
];

const TOKEN_NORMALIZATION_REPLACEMENTS = [
  [/\bcurrentdisabilit(?:y|ies|ys)\b/gi, 'current disability'],
  [/\bdatefrom\b/gi, 'date from'],
  [/\bdateto\b/gi, 'date to'],
  [/\breentrycode\b/gi, 'reentry code'],
  [/\bseparationauthority\b/gi, 'separation authority'],
  [/\bsocialsecurity\b/gi, 'social security'],
  [/\bactiveduty\b/gi, 'active duty'],
  [/\bdirectdeposit\b/gi, 'direct deposit'],
];

const XFA_NOISE_PATTERNS = [
  /\bsubform\b/gi,
  /\bform\d+\b/gi,
  /\bfield\d+\b/gi,
  /\bpage[_ -]?\d+\b/gi,
];

function stripImporterNoise(value) {
  let next = String(value || '');
  for (const pattern of IMPORTER_NOISE_PATTERNS) {
    next = next.replace(pattern, ' ');
  }
  return next;
}

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => stripImporterNoise(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  let next = stripImporterNoise(value);
  next = next
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2');
  for (const [pattern, replacement] of TOKEN_NORMALIZATION_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  for (const pattern of XFA_NOISE_PATTERNS) {
    next = next.replace(pattern, ' ');
  }
  return next
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stemToken(token) {
  if (!token) return '';
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

const STOP_TOKENS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'your',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'or',
  'of',
  'to',
  'in',
  'on',
  'if',
  'by',
  'at',
  'a',
  'an',
  'is',
  'be',
  'it',
  'as',
  'no',
  'yes',
  'static',
  'inferr',
  'visible',
  'pdf',
  'text',
  'because',
  'usable',
  'fillable',
  'field',
  'form',
  'page',
  'section',
]);

const NOISE_TOKEN_PATTERNS = [
  /^\d+$/,
  /^p\d+$/,
  /^f\d+$/,
  /^row\d+$/,
  /^col\d+$/,
  /^form\d+$/,
  /^field\d+$/,
  /^page\d+$/,
  /^subform$/,
  /^radio(button)?list\d*$/,
];

function isNoiseToken(token) {
  if (!token) return true;
  if (STOP_TOKENS.has(token)) return true;
  return NOISE_TOKEN_PATTERNS.some(pattern => pattern.test(token));
}

function tokenize(...parts) {
  const tokens = normalizeText(compactText(...parts))
    .split(' ')
    .map(stemToken)
    .filter(token => token.length > 1 && !isNoiseToken(token));
  return new Set(tokens);
}

function role(definition) {
  return {
    namePatterns: [],
    labelPatterns: [],
    textPatterns: [],
    optionPatterns: [],
    semanticKeywords: [],
    groupRoleHints: [],
    ...definition,
  };
}

const ROLE_DEFINITIONS = [
  role({
    role: 'email',
    family: 'contact',
    componentType: 'email',
    autocomplete: 'email',
    namePatterns: [/e[-_ ]?mail/i],
    labelPatterns: [/\be[- ]?mail\b/i, /\belectronic mail\b/i, /\belectronic correspondence\b/i],
    textPatterns: [/\be[- ]?mail\b/i, /\belectronic correspondence\b/i],
    semanticKeywords: ['email', 'mail', 'electronic', 'correspondence'],
    groupRoleHints: ['contactGroup'],
  }),
  role({
    role: 'phone',
    family: 'contact',
    componentType: 'phone',
    autocomplete: 'tel',
    namePatterns: [/\bphone\b/i, /\btelephone\b/i, /\btel\b/i, /\bcell\b/i, /\bmobile\b/i],
    labelPatterns: [/\bphone\b/i, /\btelephone\b/i, /\bmobile\b/i, /\binclude area code\b/i],
    textPatterns: [/\bphone\b/i, /\btelephone\b/i, /\binclude area code\b/i],
    semanticKeywords: ['phone', 'telephone', 'mobile', 'cell', 'area code'],
    groupRoleHints: ['contactGroup'],
  }),
  role({
    role: 'address',
    family: 'contact',
    componentType: 'address',
    namePatterns: [/\baddress\b/i, /\bstreet\b/i, /\bcity\b/i, /\bstate\b/i, /\bzip\b/i, /\bpostal\b/i],
    labelPatterns: [/\baddress\b/i, /\bstreet\b/i, /\bcity\b/i, /\bstate\b/i, /\bzip\b/i, /\bcountry\b/i],
    textPatterns: [/\baddress\b/i, /\bstreet\b/i, /\bcity\b/i, /\bstate\b/i, /\bzip\b/i, /\bcountry\b/i],
    semanticKeywords: ['address', 'street', 'city', 'state', 'zip', 'postal', 'country', 'province'],
    groupRoleHints: ['contactGroup', 'providerGroup'],
  }),
  role({
    role: 'name',
    family: 'identity',
    componentType: 'textInput',
    autocomplete: 'name',
    namePatterns: [/\bfirst[_ -]?name\b/i, /\blast[_ -]?name\b/i, /\bmiddle[_ -]?initial\b/i, /\bfull[_ -]?name\b/i, /\bclaimant[_ -]?name\b/i],
    labelPatterns: [/\bfirst\b/i, /\blast\b/i, /\bmiddle initial\b/i, /\bfull name\b/i, /\bname\b/i],
    textPatterns: [/\bfirst, middle initial, last\b/i],
    semanticKeywords: ['name', 'first', 'last', 'middle', 'initial', 'claimant', 'applicant'],
    groupRoleHints: ['identityGroup', 'dependentGroup', 'employmentGroup'],
  }),
  role({
    role: 'ssn',
    family: 'identity',
    componentType: 'maskedInput',
    namePatterns: [/\bssn\b/i, /social[_ -]?security/i],
    labelPatterns: [/\bssn\b/i, /social security/i],
    textPatterns: [/\bssn\b/i, /social security/i],
    semanticKeywords: ['ssn', 'social', 'security'],
    groupRoleHints: ['identityGroup', 'dependentGroup'],
  }),
  role({
    role: 'dateOfBirth',
    family: 'identity',
    componentType: 'date',
    namePatterns: [/\bdob\b/i, /date[_ -]?of[_ -]?birth/i, /\bbirth[_ -]?date\b/i],
    labelPatterns: [/\bdate of birth\b/i, /\bbirth date\b/i, /\bdob\b/i],
    textPatterns: [/\bdate of birth\b/i, /\bbirth date\b/i, /\bmm\/dd\/yyyy\b/i],
    semanticKeywords: ['birth', 'dob', 'date of birth', 'born'],
    groupRoleHints: ['identityGroup', 'dependentGroup'],
  }),
  role({
    role: 'dateSigned',
    family: 'signature',
    componentType: 'date',
    namePatterns: [/date[_ -]?signed/i, /signature[_ -]?date/i],
    labelPatterns: [/\bdate signed\b/i, /\bdate of signature\b/i],
    textPatterns: [/\bdate signed\b/i, /\bdate of signature\b/i],
    semanticKeywords: ['signed', 'signature date', 'date signed'],
    groupRoleHints: ['signatureGroup'],
  }),
  role({
    role: 'signature',
    family: 'signature',
    componentType: 'textInput',
    namePatterns: [/\bsignature\b/i, /\bdigital[_ -]?signature\b/i],
    labelPatterns: [/\bsignature\b/i, /authorizing disclosure/i],
    textPatterns: [/\bsignature\b/i],
    semanticKeywords: ['signature', 'sign', 'signed by', 'authorize'],
    groupRoleHints: ['signatureGroup'],
  }),
  role({
    role: 'provider',
    family: 'medical',
    componentType: 'textInput',
    namePatterns: [/\bprovider\b/i, /\bfacility\b/i, /treated[_ -]?for/i, /\bdoctor\b/i],
    labelPatterns: [/\bprovider\b/i, /\bfacility\b/i, /\btreated for\b/i, /\bmedical provider\b/i],
    textPatterns: [/\bprovider\b/i, /\bfacility\b/i, /\btreated for\b/i],
    semanticKeywords: ['provider', 'facility', 'treated', 'medical', 'doctor', 'clinic'],
    groupRoleHints: ['providerGroup', 'medicalGroup'],
  }),
  role({
    role: 'yesNo',
    family: 'meta-controls',
    componentType: 'yesNo',
    optionPatterns: [/^\s*yes\s*$/i, /^\s*no\s*$/i],
    namePatterns: [/\bis[_ -]?there\b/i, /\bhas[_ -]?the\b/i, /\bare[_ -]?you\b/i, /\bis[_ -]?this\b/i],
    labelPatterns: [/\byes\/no\b/i, /\bselect yes or no\b/i, /\bis this\b/i, /\bis this person deceased\b/i],
    semanticKeywords: ['yes', 'no', 'boolean', 'true', 'false', 'deceased'],
    groupRoleHints: ['choiceGroup'],
  }),
  role({
    role: 'checkboxChoice',
    family: 'meta-controls',
    componentType: 'checkbox',
    namePatterns: [/\bcheckbox\b/i, /\bcheck[_ -]?box\b/i],
    labelPatterns: [/\bcheck all that apply\b/i, /\bcheck box\b/i, /\bcheck the box\b/i, /\bcheck the item\b/i],
    semanticKeywords: ['checkbox', 'check box', 'select all', 'mark all', 'check', 'item'],
    groupRoleHints: ['choiceGroup'],
  }),
  role({
    role: 'radioChoice',
    family: 'meta-controls',
    componentType: 'radioButton',
    namePatterns: [/\bradio\b/i, /\boption\b/i, /\bchoose[_ -]?one\b/i],
    labelPatterns: [/\bchoose one\b/i, /\bselect one\b/i, /\boption\b/i],
    semanticKeywords: ['radio', 'option', 'choose one', 'select one'],
    groupRoleHints: ['choiceGroup'],
  }),
  role({
    role: 'selectionChoice',
    family: 'meta-controls',
    namePatterns: [/\bselect\b/i, /\bchoice\b/i],
    labelPatterns: [/\bselect\b/i, /\bchoice\b/i, /\boptions\b/i],
    semanticKeywords: ['select', 'choice', 'option', 'choose'],
    groupRoleHints: ['choiceGroup'],
  }),
  role({
    role: 'numberValue',
    family: 'claim',
    namePatterns: [/\bnumber\b/i, /\bcount\b/i, /\bqty\b/i, /\btotal\b/i, /enrolled?/i, /supported?/i, /\bfte\b/i, /\bprogram\b/i],
    labelPatterns: [/\bnumber\b/i, /\bcount\b/i, /\btotal\b/i, /\benrolled?\b/i, /\bsupported?\b/i, /\bfte\b/i],
    semanticKeywords: ['number', 'count', 'quantity', 'total', 'amount', 'enrolled', 'enrollment', 'support', 'supported', 'fte', 'program', 'student'],
    groupRoleHints: ['financialGroup', 'claimGroup', 'employmentGroup'],
  }),
  role({
    role: 'currencyAmount',
    family: 'financial',
    namePatterns: [/\bamount\b/i, /\bdollars?\b/i, /\bcents?\b/i, /\bincome\b/i, /\bexpense\b/i, /\bpayment\b/i, /\bmortgage\b/i, /\brent\b/i, /\butilities\b/i, /\bpayroll\b/i],
    labelPatterns: [/\$/i, /\bamount\b/i, /\bdollars?\b/i, /\bcents?\b/i, /\bmonthly\b/i, /\byearly\b/i, /\bpayment\b/i, /\bmortgage\b/i, /\brent\b/i, /\butilities\b/i],
    textPatterns: [/\$\s*\d/i, /\bdollars?\b/i],
    semanticKeywords: ['amount', 'dollar', 'cent', 'income', 'expense', 'monthly', 'yearly', 'financial', 'payment', 'mortgage', 'rent', 'utilities'],
    groupRoleHints: ['financialGroup', 'providerGroup', 'medicalGroup'],
  }),
  role({
    role: 'incomeAmount',
    family: 'financial',
    namePatterns: [/\bincome\b/i, /\bgross[_ -]?monthly/i, /\bbenefits?\b/i, /\bsocial\b/i, /\bnet[_ -]?take[_ -]?home[_ -]?pay\b/i],
    labelPatterns: [/\bincome\b/i, /\bgross monthly\b/i, /\bbenefits?\b/i, /\bnet take home pay\b/i],
    semanticKeywords: ['income', 'gross', 'monthly', 'wage', 'salary', 'benefit', 'take home pay', 'social'],
    groupRoleHints: ['financialGroup'],
  }),
  role({
    role: 'expenseAmount',
    family: 'financial',
    namePatterns: [/\bexpense\b/i, /\bcost\b/i, /\bpaid\b/i, /\bmortgage\b/i, /\brent\b/i, /\butilities\b/i, /\bpayroll\b/i, /\bliving[_ -]?expense\b/i],
    labelPatterns: [/\bexpense\b/i, /\bcost\b/i, /\bamount paid\b/i, /\bmortgage\b/i, /\brent\b/i, /\butilities\b/i, /\bliving expenses?\b/i],
    semanticKeywords: ['expense', 'cost', 'paid', 'payment', 'mortgage', 'rent', 'utilities', 'payroll', 'living'],
    groupRoleHints: ['financialGroup', 'medicalGroup'],
  }),
  role({
    role: 'fileNumber',
    family: 'claim',
    namePatterns: [/\bva[_ -]?file[_ -]?number\b/i, /\bfile[_ -]?number\b/i, /\bfile[_ -]?no\b/i],
    labelPatterns: [/\bva file number\b/i, /\bfile number\b/i, /\bfile no\b/i],
    semanticKeywords: ['file number', 'va file', 'reference number', 'file no'],
    groupRoleHints: ['claimGroup', 'identityGroup'],
  }),
  role({
    role: 'claimNumber',
    family: 'claim',
    namePatterns: [/\bclaim[_ -]?number\b/i, /\bissue[_ -]?number\b/i],
    labelPatterns: [/\bclaim number\b/i, /\bissue number\b/i],
    semanticKeywords: ['claim number', 'claim', 'issue number'],
    groupRoleHints: ['claimGroup'],
  }),
  role({
    role: 'policyNumber',
    family: 'claim',
    namePatterns: [/\bpolicy[_ -]?number\b/i],
    labelPatterns: [/\bpolicy number\b/i],
    semanticKeywords: ['policy number', 'policy', 'insurance number'],
    groupRoleHints: ['claimGroup'],
  }),
  role({
    role: 'bankAccount',
    family: 'financial',
    namePatterns: [/\baccount[_ -]?number\b/i, /\brouting[_ -]?number\b/i, /\bdirect[_ -]?deposit\b/i],
    labelPatterns: [/\baccount number\b/i, /\brouting number\b/i, /\bdirect deposit\b/i],
    semanticKeywords: ['account', 'routing', 'bank', 'deposit', 'financial institution'],
    groupRoleHints: ['financialGroup'],
  }),
  role({
    role: 'serviceDate',
    family: 'service',
    componentType: 'date',
    namePatterns: [/\bdate[_ -]?of[_ -]?service\b/i, /\bservice[_ -]?date\b/i, /\bentry[_ -]?date\b/i, /\bseparation[_ -]?date\b/i, /\brelease[_ -]?from[_ -]?active[_ -]?duty\b/i],
    labelPatterns: [/\bdate of service\b/i, /\bservice date\b/i, /\bentry date\b/i, /\bseparation date\b/i, /\brelease from active duty\b/i],
    semanticKeywords: ['service date', 'entry date', 'separation', 'active duty', 'military service', 'release'],
    groupRoleHints: ['serviceGroup'],
  }),
  role({
    role: 'incidentDate',
    family: 'claim',
    componentType: 'date',
    namePatterns: [/\bincident[_ -]?date\b/i, /\bdate[_ -]?of[_ -]?incident\b/i, /\baccident[_ -]?date\b/i, /\bdate[_ -]?and[_ -]?day[_ -]?of[_ -]?accident\b/i],
    labelPatterns: [/\bincident date\b/i, /\bdate of incident\b/i, /\baccident date\b/i, /\bdate and day of accident\b/i],
    semanticKeywords: ['incident date', 'accident date', 'date of incident', 'date and day of accident'],
    groupRoleHints: ['claimGroup'],
  }),
  role({
    role: 'effectiveDate',
    family: 'claim',
    componentType: 'date',
    namePatterns: [/\beffective[_ -]?date\b/i, /\bstart[_ -]?date\b/i, /\bend[_ -]?date\b/i, /\bdate[_ -]?from\b/i, /\bdate[_ -]?to\b/i, /\bfrom[_ -]?date\b/i, /\bto[_ -]?date\b/i],
    labelPatterns: [/\beffective date\b/i, /\bstart date\b/i, /\bend date\b/i, /\bdate from\b/i, /\bdate to\b/i, /\bfrom date\b/i, /\bto date\b/i],
    semanticKeywords: ['effective date', 'start date', 'end date', 'from date', 'to date'],
    groupRoleHints: ['claimGroup', 'financialGroup', 'employmentGroup'],
  }),
  role({
    role: 'relationship',
    family: 'relationship',
    namePatterns: [/\brelationship\b/i, /\brelated[_ -]?to\b/i, /\bi[_ -]?am[_ -]?the\b/i],
    labelPatterns: [/\brelationship\b/i, /\brelated to\b/i, /\bi am the\b/i],
    semanticKeywords: ['relationship', 'related', 'spouse', 'child', 'dependent', 'parent', 'claimant'],
    groupRoleHints: ['dependentGroup', 'relationshipGroup'],
  }),
  role({
    role: 'maritalStatus',
    family: 'relationship',
    namePatterns: [/\bmarital[_ -]?status\b/i, /\bmarried\b/i, /\bwidowed\b/i, /\bdivorced\b/i],
    labelPatterns: [/\bmarital status\b/i, /\bmarried\b/i, /\bwidowed\b/i, /\bdivorced\b/i],
    semanticKeywords: ['marital status', 'married', 'widowed', 'divorced', 'separated'],
    groupRoleHints: ['relationshipGroup'],
  }),
  role({
    role: 'employmentStatus',
    family: 'employment',
    namePatterns: [/\bemployment[_ -]?status\b/i, /\bemployer\b/i, /\boccupation\b/i, /\bwork\b/i, /\bhours\b/i, /\btype[_ -]?of[_ -]?employment\b/i, /\bemployment[_ -]?experience\b/i],
    labelPatterns: [/\bemployment status\b/i, /\bemployer\b/i, /\boccupation\b/i, /\bhours worked\b/i, /\btype of employment\b/i, /\bemployment experience\b/i, /\bspouse'?s employment\b/i],
    semanticKeywords: ['employment', 'employer', 'occupation', 'work', 'hours', 'job', 'retired', 'experience'],
    groupRoleHints: ['employmentGroup'],
  }),
  role({
    role: 'militaryService',
    family: 'service',
    namePatterns: [/\bservice\b/i, /\bbranch\b/i, /\brank\b/i, /\bunit\b/i, /\bdischarge\b/i, /\breentry[_ -]?code\b/i, /\bseparation[_ -]?authority\b/i, /\bcomponent\b/i],
    labelPatterns: [/\bservice\b/i, /\bbranch\b/i, /\brank\b/i, /\bdischarge\b/i, /\breentry code\b/i, /\bseparation authority\b/i, /\bcomponent\b/i],
    semanticKeywords: ['service', 'branch', 'rank', 'unit', 'discharge', 'military', 'dod', 'reentry', 'separation', 'component'],
    groupRoleHints: ['serviceGroup'],
  }),
  role({
    role: 'disabilityCondition',
    family: 'medical',
    namePatterns: [/\bdisabilit/i, /\bcondition\b/i, /\bdiagnosis\b/i, /\bsymptom\b/i],
    labelPatterns: [/\bdisability\b/i, /\bcondition\b/i, /\bdiagnosis\b/i, /\bsymptom\b/i],
    semanticKeywords: ['disability', 'condition', 'diagnosis', 'symptom', 'injury', 'illness'],
    groupRoleHints: ['medicalGroup', 'claimGroup'],
  }),
  role({
    role: 'educationLevel',
    family: 'employment',
    namePatterns: [/\beducation\b/i, /\bschool\b/i, /\btraining\b/i],
    labelPatterns: [/\beducation\b/i, /\bschool\b/i, /\btraining\b/i],
    semanticKeywords: ['education', 'school', 'training', 'college', 'degree'],
    groupRoleHints: ['employmentGroup'],
  }),
  role({
    role: 'organization',
    family: 'claim',
    namePatterns: [/\borganization\b/i, /\bagency\b/i, /\bcompany\b/i, /\binstitution\b/i],
    labelPatterns: [/\borganization\b/i, /\bagency\b/i, /\bcompany\b/i, /\binstitution\b/i],
    semanticKeywords: ['organization', 'agency', 'company', 'institution', 'employer'],
    groupRoleHints: ['claimGroup', 'employmentGroup'],
  }),
  role({
    role: 'textDetail',
    family: 'claim',
    componentType: 'textArea',
    namePatterns: [/\breason\b/i, /\bexplain\b/i, /\bdescribe\b/i, /\bstatement\b/i, /\bdetail\b/i, /\bremark/i, /\bpurpose[_ -]?of[_ -]?request\b/i, /\baction[_ -]?requested\b/i, /\bissues?_to_appeal\b/i, /\bwitnesses?\b/i],
    labelPatterns: [/\breason\b/i, /\bexplain\b/i, /\bdescribe\b/i, /\bstatement\b/i, /\bdetail\b/i, /\bsupporting document/i, /\bpurpose of request\b/i, /\baction requested\b/i, /\btype of review requested\b/i, /\bissues? (to )?appeal\b/i, /\bwitnesses?\b/i, /\bwhy i think\b/i],
    textPatterns: [/\bbrief\b/i, /\bsupporting document\b/i, /\badditional information\b/i, /\bproposed to take\b/i, /\breference to your claim\b/i],
    semanticKeywords: ['reason', 'explain', 'describe', 'statement', 'details', 'remarks', 'supporting', 'narrative', 'purpose', 'request', 'appeal', 'issue', 'witness', 'action', 'review'],
    groupRoleHints: ['claimGroup', 'medicalGroup'],
  }),
];

const ROLE_ORDER = ROLE_DEFINITIONS.map(definition => definition.role);
const ROLE_MAP = new Map(ROLE_DEFINITIONS.map(definition => [definition.role, definition]));

const GROUP_ROLE_DEFINITIONS = [
  { role: 'providerGroup', patterns: [/\bprovider\b/i, /\bfacility\b/i, /\btreated\b/i, /\bmedical\b/i] },
  { role: 'dependentGroup', patterns: [/\bchild\b/i, /\bdependent\b/i, /\bspouse\b/i] },
  { role: 'financialGroup', patterns: [/\bincome\b/i, /\bexpense\b/i, /\bamount\b/i, /\bdollar\b/i, /\bpayment\b/i] },
  { role: 'serviceGroup', patterns: [/\bservice\b/i, /\bbranch\b/i, /\brank\b/i, /\bdischarge\b/i] },
  { role: 'employmentGroup', patterns: [/\bemployer\b/i, /\bemployment\b/i, /\boccupation\b/i, /\bhours\b/i] },
  { role: 'claimGroup', patterns: [/\bclaim\b/i, /\bissue\b/i, /\bappeal\b/i, /\brequest\b/i] },
  { role: 'identityGroup', patterns: [/\bname\b/i, /\bssn\b/i, /\bsocial security\b/i, /\bdate of birth\b/i] },
  { role: 'choiceGroup', patterns: [/\byes\b/i, /\bno\b/i, /\boption\b/i, /\bcheck\b/i] },
  { role: 'relationshipGroup', patterns: [/\brelationship\b/i, /\bmarital\b/i, /\bspouse\b/i, /\bparent\b/i] },
  { role: 'contactGroup', patterns: [/\baddress\b/i, /\bemail\b/i, /\bphone\b/i, /\bcontact\b/i] },
  { role: 'signatureGroup', patterns: [/\bsignature\b/i, /\bdate signed\b/i, /\bsigned\b/i] },
  { role: 'medicalGroup', patterns: [/\bmedical\b/i, /\bcondition\b/i, /\bprovider\b/i, /\btreatment\b/i] },
];

function optionsText(field) {
  return Array.isArray(field?.options) ? field.options.join(' ') : '';
}

function fieldText(field) {
  return compactText(field?.name, field?.closestLabel, field?.neighborText, optionsText(field));
}

function deriveGroupKey(name) {
  if (!name) return null;
  const normalized = String(name)
    .replace(/^group:[^:]+:/i, '')
    .replace(/\[\d+\]/g, '[]')
    .replace(/\d+/g, '#')
    .replace(/[_\-.]+/g, '_')
    .toLowerCase();
  if (!/[a-z]/.test(normalized) || normalized.length < 8) return null;
  return normalized;
}

function classifyGroupRole(text) {
  let best = null;
  for (const definition of GROUP_ROLE_DEFINITIONS) {
    let score = 0;
    const evidence = [];
    for (const pattern of definition.patterns) {
      if (pattern.test(text)) {
        score += 1;
        evidence.push(pattern.source);
      }
    }
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = {
        role: definition.role,
        score,
        evidence,
      };
    }
  }
  if (!best) return null;
  return {
    role: best.role,
    confidence: Number(Math.min(0.92, 0.45 + best.score * 0.08).toFixed(3)),
    evidence: best.evidence.slice(0, 6),
  };
}

function buildGroupSignals(fields) {
  const groups = new Map();
  for (const [index, field] of fields.entries()) {
    const key = deriveGroupKey(field?.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  }

  const signals = new Map();
  for (const [key, indices] of groups.entries()) {
    if (indices.length < 3) continue;
    const text = indices.map(index => fieldText(fields[index])).join(' ');
    const groupRole = classifyGroupRole(text);
    const signal = {
      key,
      size: indices.length,
      role: groupRole?.role || null,
      confidence: groupRole?.confidence || 0.4,
      evidence: groupRole?.evidence || [],
    };
    for (const index of indices) {
      signals.set(index, signal);
    }
  }

  return signals;
}

function scoreDeterministic(definition, field, groupSignal) {
  const matches = [];
  let score = 0;
  const name = String(field?.name || '');
  const label = String(field?.closestLabel || '');
  const text = compactText(field?.neighborText);
  const options = optionsText(field);

  for (const pattern of definition.namePatterns) {
    if (pattern.test(name)) {
      matches.push(`name:${pattern.source}`);
      score += 3;
    }
  }
  for (const pattern of definition.labelPatterns) {
    if (pattern.test(label)) {
      matches.push(`label:${pattern.source}`);
      score += 2;
    }
  }
  for (const pattern of definition.textPatterns) {
    if (pattern.test(text)) {
      matches.push(`text:${pattern.source}`);
      score += 1;
    }
  }
  for (const pattern of definition.optionPatterns) {
    if (pattern.test(options)) {
      matches.push(`options:${pattern.source}`);
      score += 2;
    }
  }

  if (groupSignal?.role && definition.groupRoleHints.includes(groupSignal.role)) {
    matches.push(`group:${groupSignal.role}`);
    score += 2;
  }

  if (definition.role === 'provider' && /^group:address:/i.test(name)) {
    matches.push('name:group-address');
    score += 4;
  }
  if ((definition.role === 'dateOfBirth' || definition.role === 'dateSigned') && /^group:date:/i.test(name)) {
    matches.push('name:group-date');
    score += 4;
  }
  if (definition.role === 'ssn' && /^group:ssn:/i.test(name)) {
    matches.push('name:group-ssn');
    score += 4;
  }
  if (definition.role === 'name' && /^group:name:/i.test(name)) {
    matches.push('name:group-name');
    score += 4;
  }
  if (definition.role === 'phone' && /^group:phone:/i.test(name)) {
    matches.push('name:group-phone');
    score += 4;
  }
  if (definition.role === 'address' && /^group:address:/i.test(name)) {
    matches.push('name:group-address');
    score += 4;
  }

  if (matches.length === 0) return null;
  const confidence = Math.min(0.99, 0.3 + score * 0.065);
  return {
    role: definition.role,
    family: definition.family,
    confidence: Number(confidence.toFixed(3)),
    evidence: matches.slice(0, 8),
    componentType: definition.componentType || null,
    autocomplete: definition.autocomplete || null,
    source: 'deterministic',
    groupKey: groupSignal?.key || null,
    groupRole: groupSignal?.role || null,
  };
}

function semanticHit(definition, tokens, normalizedText) {
  let score = 0;
  const evidence = [];
  for (const keyword of definition.semanticKeywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) continue;
    if (normalizedKeyword.includes(' ')) {
      if (normalizedText.includes(normalizedKeyword)) {
        score += 1.35;
        evidence.push(`semantic:${normalizedKeyword}`);
      }
      continue;
    }
    const stemmed = stemToken(normalizedKeyword);
    if (tokens.has(stemmed)) {
      score += 1;
      evidence.push(`semantic:${normalizedKeyword}`);
    }
  }
  return { score, evidence };
}

function scoreSemantic(definition, field, groupSignal, tokens, normalizedText) {
  const { score: baseScore, evidence } = semanticHit(definition, tokens, normalizedText);
  let score = baseScore;
  if (groupSignal?.role && definition.groupRoleHints.includes(groupSignal.role)) {
    score += 0.8;
    evidence.push(`group:${groupSignal.role}`);
  }
  if (score < 1.5) return null;
  const confidence = Math.min(0.9, 0.42 + score * 0.065);
  return {
    role: definition.role,
    family: definition.family,
    confidence: Number(confidence.toFixed(3)),
    evidence: evidence.slice(0, 8),
    componentType: definition.componentType || null,
    autocomplete: definition.autocomplete || null,
    source: 'semantic',
    groupKey: groupSignal?.key || null,
    groupRole: groupSignal?.role || null,
  };
}

function scoreDeterministicKeywords(definition, field, groupSignal, tokens, normalizedText) {
  const { score: baseScore, evidence } = semanticHit(definition, tokens, normalizedText);
  let score = baseScore;
  if (groupSignal?.role && definition.groupRoleHints.includes(groupSignal.role)) {
    score += 0.6;
    evidence.push(`group:${groupSignal.role}`);
  }
  const semanticEvidenceCount = evidence.filter(item => item.startsWith('semantic:')).length;
  const hasPhraseEvidence = evidence.some(item => item.startsWith('semantic:') && item.includes(' '));
  if (score < 1.8 && !hasPhraseEvidence) return null;
  if (semanticEvidenceCount < 2 && !hasPhraseEvidence && !groupSignal?.role) return null;
  const confidence = Math.min(0.88, 0.35 + score * 0.058);
  return {
    role: definition.role,
    family: definition.family,
    confidence: Number(confidence.toFixed(3)),
    evidence: evidence.map(item => item.replace(/^semantic:/, 'keyword:')).slice(0, 8),
    componentType: definition.componentType || null,
    autocomplete: definition.autocomplete || null,
    source: 'deterministic',
    groupKey: groupSignal?.key || null,
    groupRole: groupSignal?.role || null,
  };
}

function chooseBestMatch(matches) {
  if (matches.length === 0) return null;
  return [...matches]
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    })[0];
}

function buildRoleMatch(roleName, source, confidence, evidence, groupSignal) {
  const definition = ROLE_MAP.get(roleName);
  if (!definition) return null;
  return {
    role: roleName,
    family: definition.family,
    confidence,
    evidence,
    componentType: definition.componentType || null,
    autocomplete: definition.autocomplete || null,
    source,
    groupKey: groupSignal?.key || null,
    groupRole: groupSignal?.role || null,
  };
}

function isLikelyAcroformFieldName(name) {
  const value = String(name || '');
  if (!value) return false;
  return /^f\[\d+\]/i.test(value) || /[#.[\]]/.test(value) || /\bsubform\b/i.test(value);
}

function fallbackDeterministicMatch(field, groupSignal, tokens, normalizedText) {
  const fieldName = String(field?.name || '');
  const rawLabel = String(field?.closestLabel || '').trim();
  const normalizedName = normalizeText(fieldName);
  const normalizedType = normalizeText(field?.type || '');
  const hasQuestionLead = /^(have you|are you|is this|did you|do you|has the|has your|were you|was the|will you|can you)\b/.test(normalizedText);
  const hasDateCue = /\bdate\b|\bmonth\b|\bday\b|\byear\b|\btime\b/.test(normalizedText);
  const options = Array.isArray(field?.options) ? field.options : [];
  const normalizedOptions = options.map(option => normalizeText(option));
  const hasYes = normalizedOptions.some(option => option === 'yes');
  const hasNo = normalizedOptions.some(option => option === 'no');

  if (hasYes && hasNo) {
    return buildRoleMatch('yesNo', 'deterministic', 0.72, ['fallback-deterministic:options:yes-no'], groupSignal);
  }

  if (options.length >= 2) {
    const roleName = /\bcheck\b|\bmark\b/.test(normalizedText) ? 'checkboxChoice' : 'selectionChoice';
    return buildRoleMatch(roleName, 'deterministic', 0.62, ['fallback-deterministic:options:multi-choice'], groupSignal);
  }

  if (
    (hasQuestionLead && !hasDateCue) ||
    /\byes no\b/.test(normalizedText) ||
    /\bradiobuttonlist\b/.test(normalizedName)
  ) {
    return buildRoleMatch('yesNo', 'deterministic', 0.58, ['fallback-deterministic:question:yes-no'], groupSignal);
  }

  if (/\bcheckbox\b/.test(normalizedType) || /\bcheck\b/.test(normalizedName)) {
    return buildRoleMatch('checkboxChoice', 'deterministic', 0.56, ['fallback-deterministic:type:checkbox'], groupSignal);
  }

  if (/\bradio\b/.test(normalizedType) || /\bradio\b/.test(normalizedName)) {
    return buildRoleMatch('radioChoice', 'deterministic', 0.56, ['fallback-deterministic:type:radio'], groupSignal);
  }

  if (/\bdate\b|\bmonth\b|\bday\b|\byear\b|\btime\b/.test(normalizedText)) {
    if (/\bincident\b|\baccident\b/.test(normalizedText)) {
      return buildRoleMatch('incidentDate', 'deterministic', 0.58, ['fallback-deterministic:token:incident-date'], groupSignal);
    }
    if (/\bservice\b|\bactive duty\b|\bentry\b|\bseparation\b|\brelease\b/.test(normalizedText)) {
      return buildRoleMatch('serviceDate', 'deterministic', 0.58, ['fallback-deterministic:token:service-date'], groupSignal);
    }
    return buildRoleMatch('effectiveDate', 'deterministic', 0.56, ['fallback-deterministic:token:date'], groupSignal);
  }

  if (/\bamount\b|\bdollar\b|\bcent\b|\bincome\b|\bexpense\b|\bpayment\b|\bmortgage\b|\brent\b|\butilities\b/.test(normalizedText)) {
    if (/\bincome\b|\bbenefit\b|\bwage\b|\bsalary\b|\btake home\b/.test(normalizedText)) {
      return buildRoleMatch('incomeAmount', 'deterministic', 0.58, ['fallback-deterministic:token:income'], groupSignal);
    }
    if (/\bexpense\b|\bmortgage\b|\brent\b|\butilities\b|\bpayroll\b/.test(normalizedText)) {
      return buildRoleMatch('expenseAmount', 'deterministic', 0.58, ['fallback-deterministic:token:expense'], groupSignal);
    }
    return buildRoleMatch('currencyAmount', 'deterministic', 0.56, ['fallback-deterministic:token:amount'], groupSignal);
  }

  if (/^static:\d+[a-z]?$/i.test(fieldName) && /^[0-9]+[a-z]?$/i.test(rawLabel)) {
    return buildRoleMatch('numberValue', 'deterministic', 0.5, ['fallback-deterministic:static-item-number'], groupSignal);
  }

  if (/\bemployment\b|\bemployer\b|\boccupation\b|\bwork\b|\bhours\b/.test(normalizedText)) {
    return buildRoleMatch('employmentStatus', 'deterministic', 0.54, ['fallback-deterministic:token:employment'], groupSignal);
  }

  if (/\bservice\b|\bbranch\b|\brank\b|\bdischarge\b|\breentry\b|\bcomponent\b/.test(normalizedText)) {
    return buildRoleMatch('militaryService', 'deterministic', 0.54, ['fallback-deterministic:token:service'], groupSignal);
  }

  if (/\brequest\b|\bappeal\b|\bissue\b|\bpurpose\b|\bwhy\b|\bwitness\b|\bexplain\b|\bdescribe\b/.test(normalizedText)) {
    return buildRoleMatch('textDetail', 'deterministic', 0.5, ['fallback-deterministic:token:text-detail'], groupSignal);
  }

  if (/^static:/i.test(String(field?.name || '')) && tokens.size >= 1) {
    return buildRoleMatch('textDetail', 'deterministic', 0.46, ['fallback-deterministic:static-generic'], groupSignal);
  }

  if (isLikelyAcroformFieldName(fieldName) && tokens.size >= 1) {
    return buildRoleMatch('textDetail', 'deterministic', 0.44, ['fallback-deterministic:acroform-generic'], groupSignal);
  }

  return null;
}

function fallbackSemanticMatch(field, groupSignal, tokens, normalizedText) {
  const options = Array.isArray(field?.options) ? field.options : [];
  const normalizedOptions = options.map(option => normalizeText(option));
  const hasYes = normalizedOptions.some(option => option === 'yes');
  const hasNo = normalizedOptions.some(option => option === 'no');

  if (hasYes && hasNo) {
    return buildRoleMatch('yesNo', 'semantic', 0.74, ['fallback:options:yes-no'], groupSignal);
  }

  if (options.length >= 2) {
    return buildRoleMatch('selectionChoice', 'semantic', 0.6, ['fallback:options:multi-choice'], groupSignal);
  }

  if (/\bdate\b|\bmonth\b|\bday\b|\byear\b/.test(normalizedText)) {
    return buildRoleMatch('effectiveDate', 'semantic', 0.56, ['fallback:token:date'], groupSignal);
  }

  if (/\bamount\b|\bdollar\b|\bcent\b|\bincome\b|\bexpense\b/.test(normalizedText)) {
    return buildRoleMatch('currencyAmount', 'semantic', 0.56, ['fallback:token:amount'], groupSignal);
  }

  if (tokens.size > 0) {
    return buildRoleMatch('textDetail', 'semantic', 0.45, ['fallback:generic-text'], groupSignal);
  }

  return null;
}

function withPatternMetadata(field, pattern) {
  if (!pattern) return field;
  const hasNameSignal = pattern.evidence.some(item => item.startsWith('name:'));
  const overrides = {
    ...(field.componentOverrides || {}),
  };
  if (
    pattern.source === 'deterministic' &&
    !overrides.type &&
    pattern.componentType &&
    hasNameSignal
  ) {
    overrides.type = pattern.componentType;
  }
  if (
    pattern.source === 'deterministic' &&
    !overrides.autocomplete &&
    pattern.autocomplete &&
    hasNameSignal
  ) {
    overrides.autocomplete = pattern.autocomplete;
  }
  return {
    ...field,
    componentPattern: {
      role: pattern.role,
      family: pattern.family,
      confidence: pattern.confidence,
      source: pattern.source,
      evidence: pattern.evidence,
      ...(pattern.groupKey ? { groupKey: pattern.groupKey } : {}),
      ...(pattern.groupRole ? { groupRole: pattern.groupRole } : {}),
    },
    componentOverrides: overrides,
  };
}

function summarizeUnmatched(unmatchedFields) {
  const tokenCounts = {};
  for (const field of unmatchedFields) {
    const tokens = tokenize(field?.name, field?.closestLabel, field?.neighborText);
    for (const token of tokens) {
      tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    }
  }
  const topTokens = Object.entries(tokenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_UNMATCHED_SUMMARY_TOKENS)
    .map(([token, count]) => ({ token, count }));

  return {
    topTokens,
    sampleFields: unmatchedFields.slice(0, 12).map(field => ({
      name: field?.name || null,
      label: field?.closestLabel || null,
    })),
  };
}

export function recognizeComponentPatterns(fields, options = {}) {
  const sourceFields = Array.isArray(fields) ? fields : [];
  const roleCounts = {};
  const familyCounts = {};
  const sourceCounts = { deterministic: 0, semantic: 0 };
  const mode = options.mode === 'deterministic' ? 'deterministic' : 'hybrid';
  const groupSignals = buildGroupSignals(sourceFields);

  let matchedFieldCount = 0;
  const nextFields = sourceFields.map((field, index) => {
    const groupSignal = groupSignals.get(index) || null;
    const normalizedText = normalizeText(fieldText(field));
    const tokenSet = tokenize(field?.name, field?.closestLabel, field?.neighborText, optionsText(field));
    const deterministicMatches = ROLE_DEFINITIONS
      .map(definition => scoreDeterministic(definition, field, groupSignal))
      .filter(Boolean);
    let pattern = chooseBestMatch(deterministicMatches);

    if (!pattern) {
      const deterministicKeywordMatches = ROLE_DEFINITIONS
        .map(definition => scoreDeterministicKeywords(definition, field, groupSignal, tokenSet, normalizedText))
        .filter(Boolean);
      pattern = chooseBestMatch(deterministicKeywordMatches);
    }

    if (!pattern) {
      pattern = fallbackDeterministicMatch(field, groupSignal, tokenSet, normalizedText);
    }

    if (!pattern && mode === 'hybrid') {
      const semanticMatches = ROLE_DEFINITIONS
        .map(definition => scoreSemantic(definition, field, groupSignal, tokenSet, normalizedText))
        .filter(Boolean);
      pattern = chooseBestMatch(semanticMatches) || fallbackSemanticMatch(field, groupSignal, tokenSet, normalizedText);
    }

    if (!pattern) return field;
    matchedFieldCount += 1;
    roleCounts[pattern.role] = (roleCounts[pattern.role] || 0) + 1;
    familyCounts[pattern.family] = (familyCounts[pattern.family] || 0) + 1;
    sourceCounts[pattern.source] = (sourceCounts[pattern.source] || 0) + 1;
    return withPatternMetadata(field, pattern);
  });

  const unmatchedFields = nextFields.filter(field => !field.componentPattern);
  const totalFieldCount = sourceFields.length;
  const coverageRatio =
    totalFieldCount === 0 ? 0 : Number((matchedFieldCount / totalFieldCount).toFixed(3));

  return {
    fields: nextFields,
    report: {
      taxonomyVersion: PATTERN_TAXONOMY_VERSION,
      mode,
      matchedFieldCount,
      totalFieldCount,
      unmatchedFieldCount: totalFieldCount - matchedFieldCount,
      coverageRatio,
      roleCounts,
      familyCounts,
      sourceCounts,
      unmatchedSummary: summarizeUnmatched(unmatchedFields),
    },
  };
}
