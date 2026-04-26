function distance(a, b) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function joinNearby(items, fieldBbox, maxDistance) {
  return items
    .filter(item => item.bbox && Math.abs(item.bbox.y - fieldBbox.y) < maxDistance)
    .sort((a, b) => distance(a.bbox, fieldBbox) - distance(b.bbox, fieldBbox))
    .slice(0, 3)
    .map(item => item.text)
    .join(' ')
    .trim();
}

function findClosestLabel(field, textPages) {
  if (!field.bbox) return null;
  const pageItems = textPages
    .find(p => p.page === field.bbox.page)?.items || [];

  if (pageItems.length === 0) return null;

  // Prefer items left or above the field, on roughly the same line.
  const sameRow = pageItems.filter(item => {
    const dy = Math.abs(item.bbox.y - field.bbox.y);
    return dy < 0.025;
  });

  if (sameRow.length > 0) {
    sameRow.sort((a, b) => distance(a.bbox, field.bbox) - distance(b.bbox, field.bbox));
    return sameRow[0].text.trim();
  }

  const aboveItems = pageItems.filter(item => item.bbox.y < field.bbox.y);
  if (aboveItems.length > 0) {
    aboveItems.sort((a, b) => {
      const verticalA = field.bbox.y - a.bbox.y;
      const verticalB = field.bbox.y - b.bbox.y;
      return verticalA - verticalB;
    });
    return aboveItems[0].text.trim();
  }

  pageItems.sort((a, b) => distance(a.bbox, field.bbox) - distance(b.bbox, field.bbox));
  return pageItems[0]?.text.trim() || null;
}

export function pairLabelsToFields(acroForm, textExtraction) {
  const textPages = textExtraction.pages || [];

  const fieldsWithLabels = acroForm.fields.map(field => {
    const closestLabel = findClosestLabel(field, textPages) || field.closestLabel || null;
    const neighborText = field.bbox
      ? joinNearby(
          textPages.find(p => p.page === field.bbox.page)?.items || [],
          field.bbox,
          0.08,
        )
      : '';

    return {
      ...field,
      closestLabel,
      neighborText: neighborText || field.neighborText || '',
    };
  });

  return {
    ...acroForm,
    fields: fieldsWithLabels,
  };
}
