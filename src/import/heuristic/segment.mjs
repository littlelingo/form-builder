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

export function segmentIntoPages(fields) {
  const sorted = sortFields(fields);
  const byPage = groupByPdfPage(sorted);
  const pages = [];

  let pageCounter = 1;
  for (const [pdfPage, pageFields] of byPage.entries()) {
    if (pageFields.length === 0) continue;
    pages.push({
      id: `page${pageCounter}`,
      title: pdfPage >= 0 ? `Page ${pdfPage + 1}` : 'Unplaced fields',
      pdfPage,
      fields: pageFields,
    });
    pageCounter += 1;
  }

  return pages;
}

export function segmentIntoChapters(pages) {
  if (pages.length === 0) return [];

  return [
    {
      id: 'imported',
      title: 'Imported form',
      pages,
    },
  ];
}
