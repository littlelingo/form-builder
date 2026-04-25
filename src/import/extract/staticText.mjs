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
  };
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
  const fields = [];
  for (const page of pages) {
    if (page.page === 0) {
      fields.push(...inferFirstPageFields(page));
    } else {
      fields.push(...inferContinuationFields(page));
    }
  }

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
