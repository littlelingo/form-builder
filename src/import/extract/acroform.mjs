import { PDFDocument, PDFCheckBox, PDFRadioGroup, PDFTextField, PDFDropdown, PDFOptionList } from 'pdf-lib';

function bboxFromWidget(widget, pageWidth, pageHeight) {
  const rect = widget.getRectangle();
  if (!rect) return null;
  const { x, y, width, height } = rect;
  return {
    x: x / pageWidth,
    y: 1 - (y + height) / pageHeight,
    w: width / pageWidth,
    h: height / pageHeight,
  };
}

function classifyAcroFormType(field) {
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'optionList';
  if (field instanceof PDFTextField) return 'text';
  return 'unknown';
}

function safeMaxLength(field) {
  if (typeof field.getMaxLength === 'function') {
    try {
      const value = field.getMaxLength();
      return typeof value === 'number' && value > 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function safeOptions(field) {
  if (typeof field.getOptions === 'function') {
    try {
      const opts = field.getOptions();
      return Array.isArray(opts) ? opts : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeIsRequired(field) {
  if (typeof field.isRequired === 'function') {
    try {
      return field.isRequired();
    } catch {
      return false;
    }
  }
  return false;
}

function safeDefaultValue(field) {
  try {
    if (typeof field.getDefaultText === 'function') return field.getDefaultText();
  } catch {
    /* noop */
  }
  return undefined;
}

export async function extractAcroForm(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const fields = form.getFields();

  const pages = doc.getPages();
  const pageDimensions = pages.map(page => ({
    width: page.getWidth(),
    height: page.getHeight(),
  }));

  const extracted = [];

  for (const field of fields) {
    const name = field.getName();
    const type = classifyAcroFormType(field);
    const required = safeIsRequired(field);
    const maxLength = safeMaxLength(field);
    const options = safeOptions(field);
    const defaultValue = safeDefaultValue(field);

    const widgets = field.acroField.getWidgets();
    if (widgets.length === 0) {
      extracted.push({
        name,
        type,
        required,
        maxLength,
        options,
        defaultValue,
        page: null,
        bbox: null,
      });
      continue;
    }

    widgets.forEach((widget, widgetIndex) => {
      let pageIndex = null;
      const ref = widget.P();
      if (ref) {
        pageIndex = pages.findIndex(page => page.ref === ref);
        if (pageIndex === -1) pageIndex = null;
      }

      const dim = pageIndex !== null ? pageDimensions[pageIndex] : null;
      const bbox = dim
        ? bboxFromWidget(widget, dim.width, dim.height)
        : null;

      extracted.push({
        name,
        type,
        required,
        maxLength,
        options,
        defaultValue,
        widgetIndex,
        widgetCount: widgets.length,
        page: pageIndex,
        bbox: bbox ? { page: pageIndex, ...bbox } : null,
      });
    });
  }

  return {
    fieldCount: fields.length,
    pageCount: pages.length,
    pageDimensions,
    fields: extracted,
  };
}
