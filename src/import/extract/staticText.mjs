function unionBbox(items) {
  const boxes = items.map(item => item.bbox).filter(Boolean);
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

function mergeLine(line, item) {
  line.items.push(item);
  line.text = line.items
    .sort((a, b) => a.bbox.x - b.bbox.x)
    .map(part => part.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  line.bbox = unionBbox(line.items);
  line.y = line.bbox?.y ?? line.y;
  return line;
}

function groupLines(page) {
  const sorted = [...(page.items || [])]
    .filter(item => item.bbox && item.text?.trim())
    .sort((a, b) => {
      const dy = a.bbox.y - b.bbox.y;
      if (Math.abs(dy) > 0.006) return dy;
      return a.bbox.x - b.bbox.x;
    });

  const lines = [];
  for (const item of sorted) {
    const existing = lines.find(line => Math.abs(line.y - item.bbox.y) < 0.006);
    if (existing) {
      mergeLine(existing, item);
    } else {
      lines.push(mergeLine({ y: item.bbox.y, text: '', items: [], bbox: null }, item));
    }
  }
  return lines.sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 0.006) return dy;
    return (a.bbox?.x ?? 0) - (b.bbox?.x ?? 0);
  });
}

function expandBbox(bbox, overrides = {}) {
  if (!bbox) return null;
  const x = overrides.x ?? Math.max(0, bbox.x - 0.005);
  const y = overrides.y ?? Math.max(0, bbox.y - 0.004);
  const w = overrides.w ?? Math.min(0.98 - x, Math.max(0.35, bbox.w + 0.12));
  const h = overrides.h ?? Math.min(0.98 - y, Math.max(0.026, bbox.h + 0.012));
  return {
    page: bbox.page,
    x,
    y,
    w: Math.max(0.01, w),
    h: Math.max(0.01, h),
  };
}

function findLine(lines, pattern) {
  return lines.find(line => pattern.test(line.text));
}

function makeStaticField(line, config) {
  return {
    name: `static:${config.name}`,
    type: config.type || 'text',
    required: false,
    maxLength: config.maxLength,
    options: config.options,
    bbox: expandBbox(line?.bbox, config.bbox || {}),
    closestLabel: config.label,
    neighborText: config.neighborText || 'Inferred from visible PDF text because no usable fillable PDF field was exposed.',
    staticSource: 'text-layout',
    provenanceOrigin: 'pdf-static-region',
    componentOverrides: config.componentOverrides,
  };
}

function normalizeLabel(label) {
  return String(label || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[:;,.]+$/g, '')
    .trim();
}

function humanizeStaticLabel(label) {
  const cleaned = cleanStaticLabel(label)
    .replace(/^\d{1,2}[A-Z]?\.\s*/, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\bI AM HOMELESS\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeLabel(cleaned)
    .replace(/\bVA\b/g, 'Va')
    .toLowerCase()
    .replace(/\b[a-z]/g, char => char.toUpperCase())
    .replace(/'S\b/g, "'s")
    .replace(/\bVa\b/g, 'VA')
    .replace(/\bSsn\b/g, 'SSN');
}

function cleanStaticLabel(label) {
  const text = normalizeLabel(label);
  if (/^branch at time of inequity or impropriety\b/i.test(text)) {
    return 'Branch at time of inequity or impropriety';
  }
  if (/^component at time of inequity or impropriety\b/i.test(text)) {
    return 'Component at time of inequity or impropriety';
  }
  if (/^highest education achieved\b/i.test(text)) {
    return 'Highest education achieved';
  }
  if (/^discharge characterization received\b/i.test(text)) {
    return 'Discharge characterization received';
  }
  if (/^action requested\b/i.test(text)) {
    return 'Action requested';
  }
  if (/^applicant must sign\b/i.test(text)) {
    return 'Applicant signature';
  }
  if (/^documents in support of claim\b/i.test(text)) {
    return 'Documents in support of claim';
  }
  if (/^other documents that may be helpful\b/i.test(text)) {
    return 'Other supporting documents';
  }
  if (/^my discharge was inequitable because\b/i.test(text)) {
    return 'Discharge inequity statement';
  }
  if (/^the discharge is improper because\b/i.test(text)) {
    return 'Discharge impropriety statement';
  }
  if (/^purpose\s*:/i.test(text)) {
    return 'Purpose of request';
  }
  if (/^authorization signature\s*:/i.test(text)) {
    return 'Authorization signature';
  }
  if (/^i am the military service member or veteran identified in section/i.test(text)) {
    return 'Requester relationship to service member';
  }
  if (/^is this person deceased\?/i.test(text)) {
    return 'Is this person deceased?';
  }
  if (/^did this person retire from military service\?/i.test(text)) {
    return 'Did this person retire from military service?';
  }
  return text
    .replace(/\b(?:NO\s+YES|YES\s+NO)\b.*$/i, '')
    .replace(/\s+\b(?:ARMY|NAVY|AIR FORCE|COAST GUARD|MARINE CORPS)\b.*$/i, '')
    .replace(/\s+\b(?:GED|HIGH SCHOOL DIPLOMA|BACHELOR'S DEGREE|MASTER'S DEGREE|DOCTORATE DEGREE)\b.*$/i, '')
    .replace(/\s+\b(?:REGULAR|RESERVE|GUARD)\b(?:\s+\b(?:REGULAR|RESERVE|GUARD)\b)*$/i, '')
    .replace(/\s+\(?(?:select one|select all that apply)\.?\)?$/i, '');
}

function toStaticKey(label, fallback) {
  const words = humanizeStaticLabel(label)
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

function inferStaticType(label) {
  const text = label.toLowerCase();
  if (/\b(e-mail|email)\b/.test(text)) return 'email';
  if (/\b(phone|telephone)\b/.test(text)) return 'phone';
  if (/\b(no\s+yes|yes\s+no)\b/.test(text) || /\?$/.test(text)) return 'yesNo';
  if (/\b(date|dob)\b/.test(text) || /\b(date of birth|birth date)\b/.test(text)) return 'date';
  if (/\b(ssn|social security)\b/.test(text)) return 'text';
  if (/\b(address|street|p\.o\.|zip|mailing)\b/.test(text)) return 'text';
  if (/\b(issue|remarks|explain|why|additional|purpose)\b/.test(text)) return 'text';
  return 'text';
}

function staticComponentOverrides(label, type) {
  const text = label.toLowerCase();
  if (type === 'email') return { type: 'email' };
  if (type === 'phone') return { type: 'phone' };
  if (type === 'date') return { type: 'date' };
  if (type === 'yesNo') return { type: 'yesNo' };
  if (/^place of birth$/i.test(text)) return { type: 'textInput' };
  if (/\b(ssn|social security)\b/.test(text)) {
    return {
      type: 'maskedInput',
      hint: 'Enter the Social Security number without dashes.',
      maxLength: 11,
    };
  }
  if (/\b(address|street|p\.o\.|zip|mailing)\b/.test(text)) {
    return { type: 'address' };
  }
  if (/\b(issue|remarks|explain|why|additional|purpose)\b/.test(text)) {
    return { type: 'textArea', maxLength: 2000 };
  }
  return {};
}

function isInstructionPage(page, lines) {
  const text = lines.map(line => line.text).join(' ');
  if (parseNumberedLabels(text).length >= 4) return false;
  return /\b(INFORMATION AND DETAILED INSTRUCTIONS|OVERVIEW OF .* FORM SECTIONS|PRIVACY ACT STATEMENT|RESPONDENT BURDEN)\b/i.test(text) &&
    !/\bPART I\b|\bSECTION I\b/.test(text.slice(0, 500));
}

function isWeakStaticQuestion(label) {
  const text = normalizeLabel(label).toLowerCase();
  return (
    text.length < 5 ||
    /^\([^)]*\)$/.test(text) ||
    /^page\s+\d+$/i.test(text) ||
    /^item\s+\d+[a-z]?$/i.test(text) ||
    /^(part|section)\s+[ivx]+/.test(text) ||
    /\b(instructions?|note|penalty|privacy act|respondent burden|omb approved|expiration date|va form)\b/.test(text) ||
    /\b(general information|how to submit|what you need to do|how va will help|where to send|evidence must show|va forms are available|www\.|va\.gov|for free help|do not send completed forms|public reporting burden|requested information|disclosure of the information|definitions and abbreviations|archival records|personnel records|national archives trust fund|not available|example evidence|mail your form|this pension center)\b/.test(text) ||
    /^(if you|the service member or|where reply may be sent|the complete|service completed before|html on|in rare cases|hearing loss noise|diabetes agent orange|left knee)/.test(text)
  );
}

function parseNumberedLabels(text) {
  const normalized = normalizeLabel(text);
  const pattern = /(?:^|\s)(\d{1,2})([A-Z])?\.\s+(.+?)(?=\s+\d{1,2}[A-Z]?\.\s+|$)/g;
  const matches = [];
  let match;
  while ((match = pattern.exec(normalized))) {
    const [, number, suffix = '', rawLabel] = match;
    const label = normalizeLabel(rawLabel);
    if (isWeakStaticQuestion(label)) continue;
    matches.push({
      number,
      suffix,
      label,
      fullLabel: `${number}${suffix}. ${label}`,
    });
  }
  return matches;
}

function inferGenericStaticFieldsForPage(page) {
  const lines = groupLines(page);
  if (isInstructionPage(page, lines)) return [];

  const parsed = lines.flatMap(line =>
    parseNumberedLabels(line.text).map(parsedLabel => ({
      line,
      parsed: parsedLabel,
    })),
  );
  if (parsed.length === 0) return [];

  const byNumber = new Map();
  for (const item of parsed) {
    const key = item.parsed.number;
    if (!byNumber.has(key)) byNumber.set(key, []);
    byNumber.get(key).push(item);
  }

  const fields = [];
  const seenKeys = new Set();
  for (const [number, items] of byNumber.entries()) {
    const base = items.find(item => !item.parsed.suffix);
    const suffixed = items.filter(item => item.parsed.suffix);

    if (base && suffixed.length >= 2) {
      let label = humanizeStaticLabel(base.parsed.label);
      if (/following review options|review option/i.test(base?.parsed.label || '')) {
        label = 'Board Review Option';
      }
      const options = suffixed.map(item => humanizeStaticLabel(item.parsed.label));
      const key = toStaticKey(label, `item${number}`);
      fields.push(
        makeStaticField(base?.line || suffixed[0].line, {
          name: key,
          label,
          type: 'radio',
          options,
          neighborText: suffixed.map(item => item.parsed.fullLabel).join(' '),
        }),
      );
      seenKeys.add(key);
      continue;
    }

    for (const item of items) {
      const label = humanizeStaticLabel(item.parsed.label);
      const key = toStaticKey(label, `item${item.parsed.number}${item.parsed.suffix}`);
      if (seenKeys.has(key)) continue;
      const type = inferStaticType(label);
      fields.push(
        makeStaticField(item.line, {
          name: key,
          label,
          type,
          maxLength: type === 'text' ? 120 : undefined,
          neighborText: item.parsed.fullLabel,
          componentOverrides: staticComponentOverrides(label, type),
        }),
      );
      seenKeys.add(key);
    }
  }

  return fields;
}

const FIRST_PAGE_PATTERNS = [
  {
    key: 'nameOfVeteran',
    pattern: /\b1\.\s*NAME OF VETERAN\b/i,
    label: 'Name of veteran',
    maxLength: 80,
  },
  {
    key: 'claimFileNumber',
    pattern: /\b2\.\s*CLAIM FILE (?:NO\.?|NUMBER)\b/i,
    label: 'Claim file number',
    maxLength: 40,
  },
  {
    key: 'insuranceOrLoanNumber',
    pattern: /\b3\.\s*INSURANCE FILE (?:NO\.?|NUMBER).*LOAN/i,
    label: 'Insurance file number or loan number',
    maxLength: 40,
  },
  {
    key: 'iAmThe',
    pattern: /\b4\.\s*I AM THE\b/i,
    label: 'I am the',
    type: 'radio',
    options: ["Veteran", "Veteran's widow/er", "Veteran's child", "Veteran's parent", 'Other'],
  },
  {
    key: 'homeTelephoneNumber',
    pattern: /\bA\.\s*HOME\b/i,
    label: 'Home telephone number',
    maxLength: 30,
  },
  {
    key: 'workTelephoneNumber',
    pattern: /\bB\.\s*WORK\b/i,
    label: 'Work telephone number',
    maxLength: 30,
  },
  {
    key: 'myAddress',
    pattern: /\b6\.\s*MY ADDRESS IS\b/i,
    label: 'My address',
    maxLength: 240,
  },
  {
    key: 'claimantName',
    pattern: /\b7\.\s*IF I AM NOT THE VETERAN.*MY NAME IS\b/i,
    label: 'If I am not the Veteran, my name is',
    maxLength: 80,
  },
  {
    key: 'issuesAppealScope',
    pattern: /\b8\.\s*THESE ARE THE ISSUES\b/i,
    label: 'Issues to appeal',
    type: 'radio',
    options: [
      'I am only appealing these issues',
      'I want to appeal all issues listed on the statement of the case',
    ],
  },
  {
    key: 'issuesToAppeal',
    pattern: /\b8\.\s*THESE ARE THE ISSUES\b/i,
    label: 'Issues I want to appeal',
    maxLength: 2000,
    bbox: { y: 0.365, h: 0.1 },
  },
  {
    key: 'whyVaDecidedIncorrectly',
    pattern: /\b9\.\s*HERE IS WHY\b/i,
    label: 'Why I think VA decided my case incorrectly',
    maxLength: 5000,
    bbox: { h: 0.22 },
  },
  {
    key: 'optionalBoardHearing',
    pattern: /\b10\.\s*OPTIONAL BOARD HEARING\b|\bOPTIONAL BOARD HEARING\b/i,
    label: 'Optional Board hearing',
    type: 'radio',
    options: [
      'I do not want an optional Board hearing',
      'Live videoconference at a local VA office',
      'In Washington, DC',
      'At a local VA office',
    ],
  },
  {
    key: 'appealSignature',
    pattern: /\b11\.\s*SIGNATURE OF PERSON MAKING THIS APPEAL\b/i,
    label: 'Signature of person making this appeal',
    maxLength: 120,
  },
  {
    key: 'appealSignatureDate',
    pattern: /\b12\.\s*DATE\b/i,
    label: 'Date signed',
    maxLength: 20,
  },
  {
    key: 'representativeSignature',
    pattern: /\b13\.\s*SIGNATURE OF APPOINTED REPRESENTATIVE\b/i,
    label: 'Signature of appointed representative',
    maxLength: 120,
  },
  {
    key: 'representativeSignatureDate',
    pattern: /\b14\.\s*DATE\b/i,
    label: 'Representative date signed',
    maxLength: 20,
  },
];

function inferFirstPageFields(page) {
  const lines = groupLines(page);
  const fields = [];
  const seen = new Set();
  for (const config of FIRST_PAGE_PATTERNS) {
    if (seen.has(config.key)) continue;
    const line = findLine(lines, config.pattern);
    if (!line) continue;
    fields.push(
      makeStaticField(line, {
        name: config.key,
        label: config.label,
        type: config.type,
        maxLength: config.maxLength,
        options: config.options,
        bbox: config.bbox,
      }),
    );
    seen.add(config.key);
  }
  return fields;
}

function inferContinuationFields(page) {
  const lines = groupLines(page);
  const line = findLine(lines, /\bCONTINUATION SHEET\b.*\bITEM\s*9\b/i);
  if (!line) return [];
  return [
    makeStaticField(line, {
      name: 'continuationWhyVaDecidedIncorrectly',
      label: 'Continuation for why I think VA decided my case incorrectly',
      maxLength: 5000,
      bbox: { h: 0.72 },
    }),
  ];
}

export function inferStaticTextFields(textExtraction) {
  const pages = textExtraction.pages || [];
  const specificFields = [];
  for (const page of pages) {
    if (page.page === 0) {
      specificFields.push(...inferFirstPageFields(page));
    } else {
      specificFields.push(...inferContinuationFields(page));
    }
  }

  const genericFields = pages.flatMap(page => inferGenericStaticFieldsForPage(page));
  const fields = specificFields.length >= 5 ||
    genericFields.length === 0 ||
    genericFields.length <= specificFields.length
    ? specificFields
    : genericFields;

  return {
    pageCount: textExtraction.pageCount || pages.length,
    fieldCount: fields.length,
    fields,
    inference: {
      source: 'text-layout',
      reason:
        fields.length > 0
          ? 'No usable AcroForm fields were exposed, so visible PDF text was mapped into draft builder components.'
          : 'No usable AcroForm fields were exposed and no supported static text patterns were found.',
    },
  };
}
