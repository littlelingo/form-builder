import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

function bboxFromTextItem(item, viewport) {
  const transform = item.transform;
  const x = transform[4];
  const y = transform[5];
  const width = item.width || 0;
  const height = item.height || 0;
  const pageWidth = viewport.viewBox[2];
  const pageHeight = viewport.viewBox[3];
  return {
    x: x / pageWidth,
    y: 1 - (y + height) / pageHeight,
    w: width / pageWidth,
    h: height / pageHeight,
  };
}

function emitProgress(onProgress, event) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress(event);
  } catch {
    // Progress callbacks should not affect import results.
  }
}

export async function extractText(pdfBytes, options = {}) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

  const loadingTask = getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    emitProgress(options.onProgress, {
      stage: 'extract-text',
      detail: `Reading page ${pageNum} of ${doc.numPages}`,
      pageNumber: pageNum,
      pageCount: doc.numPages,
    });
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    const items = content.items
      .filter(item => 'str' in item && item.str && item.str.trim().length > 0)
      .map(item => ({
        text: item.str,
        page: pageNum - 1,
        bbox: { page: pageNum - 1, ...bboxFromTextItem(item, viewport) },
      }));

    pages.push({
      page: pageNum - 1,
      width: viewport.viewBox[2],
      height: viewport.viewBox[3],
      items,
    });
  }

  await doc.cleanup();

  return {
    pageCount: doc.numPages,
    pages,
  };
}
