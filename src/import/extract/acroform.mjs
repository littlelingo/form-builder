import { PDFDocument, PDFCheckBox, PDFRadioGroup, PDFTextField, PDFDropdown, PDFOptionList } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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

function parsePx(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.replace(/px$/i, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function nodeClasses(node) {
  const classes = node?.attributes?.class;
  return Array.isArray(classes) ? classes : [];
}

function hasClass(node, className) {
  return nodeClasses(node).includes(className);
}

function nodeText(node) {
  if (!node || typeof node !== 'object') return '';
  const chunks = [];
  function walk(current) {
    if (!current || typeof current !== 'object') return;
    if (typeof current.value === 'string') chunks.push(current.value);
    for (const child of current.children || []) walk(child);
  }
  walk(node);
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function firstDescendant(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  const queue = [...(node.children || [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (predicate(current)) return current;
    queue.push(...(current.children || []));
  }
  return null;
}

function descendants(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  const result = [];
  const queue = [...(node.children || [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (predicate(current)) result.push(current);
    queue.push(...(current.children || []));
  }
  return result;
}

function humanizeName(name) {
  return String(name || '')
    .replace(/[_#]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractXfaFieldLabel(fieldNode) {
  const labels = descendants(fieldNode, node => hasClass(node, 'xfaLabel'))
    .map(nodeText)
    .filter(Boolean);
  if (labels.length > 0) {
    return labels
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return nodeText(fieldNode);
}

function extractXfaOptions(fieldNode) {
  const selectNode = firstDescendant(fieldNode, node => node.name === 'select');
  if (!selectNode) return [];
  const optionNodes = descendants(selectNode, node => node.name === 'option');
  return optionNodes
    .map(option => {
      const explicit = option?.attributes?.value;
      if (typeof explicit === 'string' && explicit.trim().length > 0) return explicit.trim();
      return nodeText(option);
    })
    .filter(Boolean);
}

function classifyXfaFieldType(fieldNode, interactiveNode) {
  const interactiveClasses = nodeClasses(interactiveNode);
  const inputType = String(interactiveNode?.attributes?.type || '').toLowerCase();
  if (
    interactiveNode?.name === 'select' ||
    interactiveClasses.includes('xfaSelect') ||
    interactiveClasses.includes('xfaChoiceList')
  ) {
    return 'dropdown';
  }
  if (interactiveNode?.name === 'textarea') return 'text';
  if (
    inputType === 'checkbox' ||
    interactiveClasses.includes('xfaCheckbox') ||
    interactiveClasses.includes('xfaCheckButton')
  ) {
    return 'checkbox';
  }
  if (inputType === 'radio' || interactiveClasses.includes('xfaRadio')) {
    return 'radio';
  }
  return 'text';
}

function xfaBbox(wrapperStyle, pageInfo) {
  if (!wrapperStyle || !pageInfo) return null;
  const left = parsePx(wrapperStyle.left);
  const top = parsePx(wrapperStyle.top);
  const width = parsePx(wrapperStyle.width);
  const height = parsePx(wrapperStyle.height);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  if (!Number.isFinite(pageInfo.width) || !Number.isFinite(pageInfo.height)) return null;
  return {
    page: pageInfo.index,
    x: left / pageInfo.width,
    y: top / pageInfo.height,
    w: width / pageInfo.width,
    h: height / pageInfo.height,
  };
}

function deriveXfaFieldName(fieldNode, fallbackIndex) {
  const xfaName = fieldNode?.attributes?.xfaName;
  const id = fieldNode?.attributes?.id;
  if (xfaName && id) return `${xfaName}#${id}`;
  if (xfaName) return xfaName;
  if (id) return id;
  return `xfaField${fallbackIndex + 1}`;
}

function xfaPageInfo(node, pageRegistry) {
  if (!hasClass(node, 'xfaPage')) return null;
  const pageId = node?.attributes?.id || `xfaPage${pageRegistry.size + 1}`;
  if (pageRegistry.has(pageId)) return pageRegistry.get(pageId);
  const page = {
    id: pageId,
    index: pageRegistry.size,
    width: parsePx(node?.attributes?.style?.width) ?? 612,
    height: parsePx(node?.attributes?.style?.height) ?? 792,
  };
  pageRegistry.set(pageId, page);
  return page;
}

export function extractXfaFieldsFromHtml(xfaRoot, options = {}) {
  if (!xfaRoot || typeof xfaRoot !== 'object') {
    return {
      pageCount: Number.isFinite(options.defaultPageCount) ? options.defaultPageCount : 0,
      fields: [],
    };
  }
  const pageRegistry = new Map();
  const fields = [];

  function walk(node, context = {}) {
    if (!node || typeof node !== 'object') return;
    const page = xfaPageInfo(node, pageRegistry) || context.page || null;
    const wrapper = hasClass(node, 'xfaWrapper') ? node?.attributes?.style || null : context.wrapper || null;
    const nextContext = { page, wrapper };

    if (hasClass(node, 'xfaField')) {
      const interactive = firstDescendant(
        node,
        candidate => ['input', 'textarea', 'select'].includes(candidate?.name),
      );
      if (interactive) {
        const type = classifyXfaFieldType(node, interactive);
        const label = extractXfaFieldLabel(node);
        const rawName = deriveXfaFieldName(node, fields.length);
        const bbox = xfaBbox(wrapper, page);
        const maxLength = Number.parseInt(interactive?.attributes?.maxLength, 10);
        fields.push({
          name: rawName,
          type,
          required: false,
          maxLength: Number.isFinite(maxLength) && maxLength > 0 ? maxLength : undefined,
          options: type === 'dropdown' ? extractXfaOptions(node) : [],
          defaultValue:
            typeof interactive?.attributes?.value === 'string' ? interactive.attributes.value : undefined,
          widgetIndex: 0,
          widgetCount: 1,
          page: page?.index ?? 0,
          bbox,
          closestLabel: label || humanizeName(rawName) || 'Imported field',
          neighborText:
            'Extracted from XFA field metadata because no standard AcroForm widgets were exposed.',
          source: 'xfa-html',
        });
      }
    }

    for (const child of node.children || []) {
      walk(child, nextContext);
    }
  }

  walk(xfaRoot, {});

  return {
    pageCount: pageRegistry.size || (Number.isFinite(options.defaultPageCount) ? options.defaultPageCount : 0),
    fields,
  };
}

async function extractXfaFallback(pdfBytes) {
  const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const loadingTask = getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
    enableXfa: true,
  });
  const doc = await loadingTask.promise;
  try {
    if (!doc.isPureXfa) return null;
    const xfaRoot = await doc.allXfaHtml;
    if (!xfaRoot) return null;
    const parsed = extractXfaFieldsFromHtml(xfaRoot, { defaultPageCount: doc.numPages });
    if (!parsed.fields.length) return null;
    return {
      fieldCount: parsed.fields.length,
      pageCount: parsed.pageCount || doc.numPages,
      pageDimensions: [],
      fields: parsed.fields,
      source: 'xfa-html',
    };
  } finally {
    await doc.cleanup();
  }
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

  if (fields.length === 0) {
    const xfaFallback = await extractXfaFallback(pdfBytes);
    if (xfaFallback) {
      return xfaFallback;
    }
  }

  return {
    fieldCount: fields.length,
    pageCount: pages.length,
    pageDimensions,
    fields: extracted,
    source: 'acroform',
  };
}
