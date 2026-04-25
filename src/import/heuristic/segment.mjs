function fieldSortKey(field) {
  if (!field.bbox) return [Number.MAX_SAFE_INTEGER, 0, 0];
  return [field.bbox.page, field.bbox.y, field.bbox.x];
}

function sortFields(fields) {
  return [...fields].sort((a, b) => {
    const [ap, ay, ax] = fieldSortKey(a);
    const [bp, by, bx] = fieldSortKey(b);
    if (ap !== bp) return ap - bp;
    if (ay !== by) return ay - by;
    return ax - bx;
  });
}

function groupByPdfPage(fields) {
  const map = new Map();
  for (const field of fields) {
    const page = field.bbox?.page ?? -1;
    if (!map.has(page)) map.set(page, []);
    map.get(page).push(field);
  }
  return map;
}

function compactText(values) {
  return values
    .flat()
    .filter(Boolean)
    .map(value => String(value))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slug(input, fallback) {
  const words = String(input || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return fallback;
  const [first, ...rest] = words;
  return (
    first.charAt(0).toLowerCase() +
    first.slice(1) +
    rest.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')
  );
}

const SEMANTIC_PAGE_RULES = [
  {
    id: 'veteranInformation',
    title: 'Veteran information',
    patterns: [
      /\bveteran\b|\bservice member\b/,
      /\bsocial security\b|\bssn\b/,
      /\bdate of birth\b|\bbirth date\b/,
      /\bclaim file\b|\bva file\b/,
    ],
  },
  {
    id: 'contactInformation',
    title: 'Contact information',
    patterns: [
      /\bemail\b|\be-mail\b/,
      /\bphone\b|\btelephone\b/,
      /\bmailing address\b|\bstreet address\b|\bzip\b/,
    ],
  },
  {
    id: 'serviceInformation',
    title: 'Military service',
    patterns: [
      /\bservice\b|\bserved\b|\bactive duty\b/,
      /\bbranch\b|\bcomponent\b/,
      /\bdischarge\b|\bseparation\b|\bentered\b/,
    ],
  },
  {
    id: 'claimInformation',
    title: 'Claim information',
    patterns: [
      /\bclaim\b|\bbenefit\b|\bcompensation\b|\bpension\b/,
      /\bissue\b|\bappeal\b|\bdisagreement\b/,
      /\bdisability\b|\bcondition\b/,
    ],
  },
  {
    id: 'medicalInformation',
    title: 'Medical information',
    patterns: [
      /\bmedical\b|\btreatment\b|\bprovider\b/,
      /\bhospital\b|\bfacility\b|\bdoctor\b|\bphysician\b/,
      /\bdiagnosis\b|\bpatient\b/,
    ],
  },
  {
    id: 'employmentInformation',
    title: 'Employment information',
    patterns: [
      /\bemploy\b|\bemployer\b|\boccupation\b/,
      /\bworked\b|\bwork history\b|\bdates? of employment\b|\blast date of employment\b/,
      /\bearnings\b|\bwages\b/,
    ],
  },
  {
    id: 'financialInformation',
    title: 'Financial information',
    patterns: [
      /\bincome\b|\basset\b|\bexpense\b|\bdebt\b/,
      /\bbank\b|\baccount\b|\brouting\b/,
      /\bnet worth\b|\bfinancial\b/,
    ],
  },
  {
    id: 'educationInformation',
    title: 'Education and training',
    patterns: [
      /\beducation\b|\bschool\b|\btraining\b/,
      /\bdegree\b|\bprogram\b/,
      /\bchapter 36\b|\bcareer\b/,
    ],
  },
  {
    id: 'authorizationSignature',
    title: 'Authorization and signature',
    patterns: [
      /\bsignature\b|\bsigned\b/,
      /\bauthorization\b|\bcertification\b|\bconsent\b/,
      /\bdate signed\b|\bwitness\b/,
    ],
  },
];

const REPEATED_GROUP_RULES = [
  {
    id: 'treatmentProviders',
    title: 'Treatment providers',
    pageTitle: 'Provider details',
    nounSingular: 'provider',
    nounPlural: 'providers',
    itemNameLabel: 'Provider or facility name',
    sectionIntro: 'Add each provider or facility listed on the source form.',
    maxItems: 20,
    requiredPatterns: [/\bprovider\b|\bfacility\b/, /\btreatment\b|\bdate\b/],
    anyPatterns: [/\bstreet address\b|\baddress\b/],
    maxPrototypeFields: 8,
  },
  {
    id: 'employmentHistory',
    title: 'Employment history',
    pageTitle: 'Employer details',
    nounSingular: 'employer',
    nounPlural: 'employers',
    itemNameLabel: 'Employer name',
    sectionIntro: 'Add each employer or self-employment period listed on the source form.',
    maxItems: 20,
    requiredPatterns: [/\bemployer\b|\bemploy\b/, /\bdate\b|\bworked\b|\bwages\b|\bearnings\b/],
    anyPatterns: [/\baddress\b|\boccupation\b|\bjob\b/],
    maxPrototypeFields: 8,
  },
  {
    id: 'dependentInformation',
    title: 'Dependents',
    pageTitle: 'Dependent details',
    nounSingular: 'dependent',
    nounPlural: 'dependents',
    itemNameLabel: 'Dependent name',
    sectionIntro: 'Add each dependent listed on the source form.',
    maxItems: 20,
    requiredPatterns: [/\bdependent\b|\bchild\b|\bspouse\b/, /\bname\b/],
    anyPatterns: [/\bdate of birth\b|\bssn\b|\bsocial security\b/],
    maxPrototypeFields: 8,
  },
];

function inferSemanticPage(pageFields) {
  const text = compactText(
    pageFields.map(field => [field.name, field.closestLabel, field.neighborText]),
  );
  if (!text) return null;

  const scored = SEMANTIC_PAGE_RULES.map(rule => ({
    id: rule.id,
    title: rule.title,
    score: rule.patterns.filter(pattern => pattern.test(text)).length,
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 2) return null;
  return best;
}

function normalizeLabelKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function repeatedFieldPriority(field) {
  const label = normalizeLabelKey(field.closestLabel || field.name);
  if (/\b(address|street|city|state|zip)\b/.test(label)) return 3;
  if (/\b(date|period|from|to)\b/.test(label)) return 2;
  if (/\b(name|provider|facility|employer|dependent|school)\b/.test(label)) return 1;
  if (/\bphone|email|contact\b/.test(label)) return 4;
  return 5;
}

function matchRepeatedGroupRule(repeatedLabels) {
  const text = compactText(repeatedLabels);
  return REPEATED_GROUP_RULES.find(rule => {
    const required = rule.requiredPatterns.every(pattern => pattern.test(text));
    const any = rule.anyPatterns.length === 0 || rule.anyPatterns.some(pattern => pattern.test(text));
    return required && any;
  }) || null;
}

function clonePrototypeField(field, rule) {
  const isSummaryField = repeatedFieldPriority(field) === 1;
  return {
    ...field,
    componentOverrides: {
      ...(field.componentOverrides || {}),
      ...(isSummaryField ? { summaryCard: true } : {}),
    },
    repeatedGroup: {
      source: 'heuristic',
      groupId: rule.id,
    },
  };
}

function extractRepeatedGroup(pages) {
  const flattened = pages.flatMap((page, pageIndex) =>
    (page.fields || []).map((field, fieldIndex) => ({
      pageIndex,
      fieldIndex,
      field,
      labelKey: normalizeLabelKey(field.closestLabel || field.name),
    })),
  );
  const labelCounts = new Map();
  for (const item of flattened) {
    if (!item.labelKey) continue;
    labelCounts.set(item.labelKey, (labelCounts.get(item.labelKey) || 0) + 1);
  }

  const repeatedKeys = new Set(
    [...labelCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([label]) => label),
  );
  if (repeatedKeys.size < 2) return { pages, chapters: [] };

  const repeatedItems = flattened.filter(item => repeatedKeys.has(item.labelKey));
  const rule = matchRepeatedGroupRule(repeatedItems.map(item => item.field.closestLabel || item.field.name));
  if (!rule) return { pages, chapters: [] };

  const prototypeByLabel = new Map();
  for (const item of repeatedItems) {
    if (!prototypeByLabel.has(item.labelKey)) {
      prototypeByLabel.set(item.labelKey, item);
    }
  }
  if (rule.maxPrototypeFields && prototypeByLabel.size > rule.maxPrototypeFields) {
    return { pages, chapters: [] };
  }

  const prototypeFields = [...prototypeByLabel.values()]
    .sort((a, b) => {
      const priorityDiff = repeatedFieldPriority(a.field) - repeatedFieldPriority(b.field);
      if (priorityDiff !== 0) return priorityDiff;
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return a.fieldIndex - b.fieldIndex;
    })
    .map(item => clonePrototypeField(item.field, rule));

  const remainingPages = pages
    .map(page => ({
      ...page,
      fields: (page.fields || []).filter(field =>
        !repeatedKeys.has(normalizeLabelKey(field.closestLabel || field.name)),
      ),
    }))
    .filter(page => page.fields.length > 0);

  return {
    pages: remainingPages,
    chapters: [
      {
        id: rule.id,
        type: 'listLoop',
        title: rule.title,
        sectionIntro: rule.sectionIntro,
        itemNameLabel: rule.itemNameLabel,
        options: {
          nounSingular: rule.nounSingular,
          nounPlural: rule.nounPlural,
          arrayPath: rule.id,
          required: false,
          maxItems: rule.maxItems,
        },
        pages: [
          {
            id: `${rule.id}Details`,
            title: rule.pageTitle,
            fields: prototypeFields,
          },
        ],
      },
    ],
  };
}

export function segmentIntoPages(fields) {
  const sorted = sortFields(fields);
  const byPage = groupByPdfPage(sorted);
  const pages = [];

  let pageCounter = 1;
  for (const [pdfPage, pageFields] of byPage.entries()) {
    if (pageFields.length === 0) continue;
    const semanticPage = inferSemanticPage(pageFields);
    pages.push({
      id: `page${pageCounter}`,
      title: semanticPage?.title || (pdfPage >= 0 ? `Page ${pdfPage + 1}` : 'Unplaced fields'),
      semanticId: semanticPage?.id || null,
      pdfPage,
      fields: pageFields,
    });
    pageCounter += 1;
  }

  return pages;
}

export function segmentIntoChapters(pages) {
  if (pages.length === 0) return [];
  const repeatedGroup = extractRepeatedGroup(pages);
  const segmentPages = repeatedGroup.pages;
  const hasSemanticPages = pages.some(page => page.semanticId);

  if (hasSemanticPages) {
    return [
      ...segmentPages.map((page, index) => ({
        id: page.semanticId
          ? `${page.semanticId}${index + 1}`
          : `needsReview${index + 1}`,
        title: page.semanticId ? page.title : 'Needs review',
        pages: [
          {
            ...page,
            id: `${slug(page.title, page.id)}${index + 1}`,
            title: page.semanticId ? 'Details' : page.title,
          },
        ],
      })),
      ...repeatedGroup.chapters,
    ];
  }

  if (segmentPages.length === 0) return repeatedGroup.chapters;

  return [
    {
      id: 'imported',
      title: 'Imported form',
      pages: segmentPages,
    },
    ...repeatedGroup.chapters,
  ];
}
