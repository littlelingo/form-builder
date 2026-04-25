import { compileAuthoringForm } from '../compiler/authoringCompiler.mjs';
import { generatedComputedHelperCode } from '../compiler/computedValues.mjs';
import { generatedEventHelperCode } from '../compiler/events.mjs';
import { generatedRuleHelperCode } from '../compiler/rules.mjs';
import { indent, jsValue, propertyKey, toIdentifier, toKebab } from '../compiler/utils.mjs';

function renderImportBlock(imports, hasListLoop, usesReact = false) {
  const patternImports = imports.filter(name => name !== 'arrayBuilderPages');
  const blocks = [];

  if (usesReact) {
    blocks.push("import React from 'react';");
  }

  if (patternImports.length) {
    blocks.push(
      `import {\n${patternImports
        .map(name => `  ${name}`)
        .join(',\n')},\n} from 'platform/forms-system/src/js/web-component-patterns';`,
    );
  }

  if (hasListLoop) {
    blocks.push(
      "import { arrayBuilderPages } from 'platform/forms-system/src/js/patterns/array-builder';",
    );
  }

  return blocks.join('\n');
}

function renderDepends(condition) {
  return condition
    ? `depends: formData => evaluateAuthoringRule(${jsValue(condition)}, formData),`
    : '';
}

function renderPrefillHelperCode() {
  return `const setAuthoringPrefillPathValue = (data, path, value) => {
  const segments = String(path).split('.').filter(Boolean);
  let current = data;
  segments.slice(0, -1).forEach(segment => {
    if (!current[segment] || typeof current[segment] !== 'object') {
      current[segment] = {};
    }
    current = current[segment];
  });
  current[segments[segments.length - 1]] = value;
  return data;
};

const applyAuthoringPrefillMappings = (mappings = [], sourceData = {}) => {
  const nextData = {};
  mappings.forEach(mapping => {
    const value = getAuthoringPathValue(sourceData, mapping.source);
    if (value !== undefined && value !== null && value !== '') {
      setAuthoringPrefillPathValue(nextData, mapping.target, value);
    }
  });
  return nextData;
};`;
}

function renderPageObject(page, form, usesEvents = false) {
  const properties = page.components
    .map(component => `      ${propertyKey(component.schemaKey || component.id)}: ${component.schemaCode}`)
    .join(',\n');
  const uiFields = page.components
    .map(component => {
      const uiSchemaCode = usesEvents && !component.contentOnly
        ? `withAuthoringFieldEvents(${jsValue(component.id)}, ${component.uiSchemaCode})`
        : component.uiSchemaCode;
      return `      ${propertyKey(component.schemaKey || component.id)}: ${uiSchemaCode}`;
    })
    .join(',\n');
  const required = page.required.length
    ? `,\n    required: ${jsValue(page.required)}`
    : '';
  const pageEnter = usesEvents
    ? `  onEnter: formData => authoringRuntime.emit('page.enter', { pageId: ${jsValue(page.id)}, formData }),`
    : '';

  return `{
  path: ${jsValue(page.path)},
  title: ${jsValue(page.title)},
  ${renderDepends(page.condition)}
${pageEnter}
  uiSchema: {
    ...titleUI(${jsValue(page.title)}, ${jsValue(page.bodyText)}),
${uiFields}
  },
  schema: {
    type: 'object',
    properties: {
${properties}
    }${required}
  }
}`;
}

function listLoopArrayPath(chapter) {
  return chapter.options.arrayPath || toKebab(chapter.options.nounPlural);
}

function renderListLoopChapter(chapter, form, usesEvents) {
  const optionsName = `${chapter.key}Options`;
  const nounSingular = chapter.options.nounSingular;
  const nounPlural = chapter.options.nounPlural;
  const arrayPath = listLoopArrayPath(chapter);
  const itemNameLabel = chapter.itemNameLabel || nounSingular;
  const summaryKey = toIdentifier(`${chapter.id} summary`);
  const namePageKey = toIdentifier(`${chapter.id} name page`);
  const introKey = toIdentifier(`${chapter.id} intro`);
  const summaryProperty = `view:has${toIdentifier(nounPlural)
    .charAt(0)
    .toUpperCase()}${toIdentifier(nounPlural).slice(1)}`;
  const firstSummaryComponent =
    chapter.pages.flatMap(page => page.components).find(component => component.source.summaryCard) ||
    chapter.pages.flatMap(page => page.components)[0];
  const getItemNameField = firstSummaryComponent?.id || 'name';

  const options = `const ${optionsName} = {
  arrayPath: ${jsValue(arrayPath)},
  nounSingular: ${jsValue(nounSingular)},
  nounPlural: ${jsValue(nounPlural)},
  required: ${jsValue(!!chapter.options.required)},
  maxItems: ${jsValue(chapter.options.maxItems || 100)},
  isItemIncomplete: item => ${jsValue(
    chapter.pages.flatMap(page =>
      page.components.filter(component => component.source.required).map(component => component.id),
    ),
  )}.some(field => !item?.[field]),
  text: {
    getItemName: item => item?.[${jsValue(getItemNameField)}] || ${jsValue(itemNameLabel)},
    cardDescription: item => [${chapter.pages
      .flatMap(page => page.components)
      .filter(component => component.source.summaryCard)
      .map(component => `item?.[${jsValue(component.id)}]`)
      .join(', ')}].filter(Boolean).join(' | '),
  },
};`;

  const introPage = chapter.options.required
    ? `${introKey}: pageBuilder.introPage({
      path: ${jsValue(toKebab(nounPlural))},
      title: ${jsValue(chapter.title)},
      uiSchema: {
        ...titleUI(${jsValue(chapter.title)}, ${jsValue(chapter.sectionIntro)}),
      },
      schema: {
        type: 'object',
        properties: {},
      },
    }),`
    : '';

  const summaryPage = `${summaryKey}: pageBuilder.summaryPage({
      path: ${jsValue(toKebab(chapter.options.required ? `${nounPlural} summary` : nounPlural))},
      title: ${jsValue(chapter.options.required ? `Review your ${nounPlural}` : chapter.title)},
      uiSchema: {
        ${jsValue(summaryProperty)}: arrayBuilderYesNoUI(${optionsName}),
      },
      schema: {
        type: 'object',
        properties: {
          ${jsValue(summaryProperty)}: arrayBuilderYesNoSchema,
        },
        required: [${jsValue(summaryProperty)}],
      },
    }),`;

  const namePage = `${namePageKey}: pageBuilder.itemPage({
      path: ${jsValue(`${toKebab(nounPlural)}/:index/name`)},
      title: ${jsValue(itemNameLabel)},
      uiSchema: {
        ...arrayBuilderItemFirstPageTitleUI({
          title: ${jsValue(itemNameLabel)},
          nounSingular: ${jsValue(nounSingular)},
        }),
        name: textUI(${jsValue('Name')}),
      },
      schema: {
        type: 'object',
        properties: {
          name: textSchema,
        },
        required: ['name'],
      },
    }),`;

  const itemPages = chapter.pages
    .map(page => {
      const pageObject = renderPageObject(
        {
          ...page,
          path: `${toKebab(nounPlural)}/:index/${toKebab(page.title || page.id)}`,
          components: page.components,
        },
        form,
        usesEvents,
      )
        .replace('...titleUI', '...arrayBuilderItemSubsequentPageTitleUI')
        .replace(
          `...arrayBuilderItemSubsequentPageTitleUI(${jsValue(page.title)}, ${jsValue(page.bodyText)})`,
          `...arrayBuilderItemSubsequentPageTitleUI(${jsValue(page.title)}, ${jsValue(page.bodyText)})`,
        );
      return `${page.key}: pageBuilder.itemPage(${pageObject}),`;
    })
    .join('\n');

  return {
    options,
    pages: `...arrayBuilderPages(${optionsName}, pageBuilder => ({
    ${introPage}
    ${summaryPage}
    ${namePage}
${indent(itemPages, 4)}
  }))`,
  };
}

function renderStandardChapter(chapter, form, usesEvents) {
  const pages = chapter.pages
    .map(page => `${page.key}: ${renderPageObject(page, form, usesEvents)}`)
    .join(',\n');

  return `${chapter.key}: {
      title: ${jsValue(chapter.title)},
      ${renderDepends(chapter.condition)}
      pages: {
${indent(pages, 8)}
      },
    }`;
}

function renderChapter(chapter, form, usesEvents) {
  if (chapter.type === 'listLoop') {
    const rendered = renderListLoopChapter(chapter, form, usesEvents);
    return {
      prelude: rendered.options,
      code: `${chapter.key}: {
      title: ${jsValue(chapter.title)},
      ${renderDepends(chapter.condition)}
      pages: {
        ${rendered.pages}
      },
    }`,
    };
  }

  return {
    prelude: '',
    code: renderStandardChapter(chapter, form, usesEvents),
  };
}

export function generateVaFormConfigModule(authoringForm, options = {}) {
  const compiled = compileAuthoringForm(authoringForm);
  const hasListLoop = compiled.chapters.some(chapter => chapter.type === 'listLoop');
  const hasChapterConditions = compiled.chapters.some(chapter => chapter.condition);
  const usesReact = compiled.chapters.some(chapter =>
    chapter.pages.some(page => page.components.some(component => component.usesReact)),
  );
  const usesPrefillMappings =
    compiled.metadata.prefillEnabled && compiled.metadata.prefillMappings.length > 0;
  const imports = renderImportBlock(compiled.imports, hasListLoop, usesReact);
  const renderedChapters = compiled.chapters.map(chapter =>
    renderChapter(chapter, compiled.source, compiled.usesEvents),
  );
  const preludes = renderedChapters
    .map(chapter => chapter.prelude)
    .filter(Boolean)
    .join('\n\n');
  const chapters = renderedChapters.map(chapter => chapter.code).join(',\n');
  const manifestImport = options.includeManifestImport
    ? "import manifest from '../manifest.json';\n"
    : '';
  const transformImport = compiled.usesComputedValues
    || compiled.usesEvents
    ? "import { transformForSubmit as platformTransformForSubmit } from 'platform/forms-system/src/js/helpers';\n"
    : '';
  const rootUrl = options.includeManifestImport
    ? 'manifest.rootUrl'
    : jsValue(compiled.metadata.rootUrl || '/');
  const helperCode = [
    compiled.usesRules || compiled.usesComputedValues || usesPrefillMappings || compiled.usesEvents
      ? generatedRuleHelperCode
      : '',
    compiled.usesComputedValues ? generatedComputedHelperCode : '',
    compiled.usesEvents ? generatedEventHelperCode : '',
    usesPrefillMappings ? renderPrefillHelperCode() : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const runtimeExport = compiled.usesEvents
    ? `export const authoringRuntime = createAuthoringRuntime({
  components: ${jsValue(compiled.metadata.componentMetadataById)},
  eventHandlers: ${jsValue(compiled.metadata.eventHandlers)},
});\n\n`
    : '';
  const transformForSubmit = compiled.usesComputedValues || compiled.usesEvents
    ? `  transformForSubmit: (config, form) => {
    const computedData = ${
      compiled.usesComputedValues
        ? `applyAuthoringComputedValues(${jsValue(compiled.metadata.computedValues)}, form.data || {})`
        : 'form.data || {}'
    };
    ${
      compiled.usesEvents
        ? `authoringRuntime.emit('form.beforeSubmit', { formData: computedData });
    const eventData = { ...computedData, ...authoringRuntime.getValues() };
    authoringRuntime.emit('form.submit', { formData: eventData });
    return platformTransformForSubmit(config, { ...form, data: eventData });`
        : 'return platformTransformForSubmit(config, { ...form, data: computedData });'
    }
  },`
    : '';
  const prefillTransformer = usesPrefillMappings
    ? `  prefillTransformer: (pages, formData, metadata) => ({
    pages,
    metadata,
    formData: applyAuthoringPrefillMappings(${jsValue(
      compiled.metadata.prefillMappings,
    )}, formData || {}),
  }),`
    : '';

  return `${manifestImport}${transformImport}${imports}

${helperCode ? `${helperCode}\n\n` : ''}${runtimeExport}${preludes ? `${preludes}\n\n` : ''}const formConfig = {
  rootUrl: ${rootUrl},
  urlPrefix: '/',
  submitUrl: ${jsValue(compiled.metadata.submitUrl || '/v0/api')},
  trackingPrefix: ${jsValue(compiled.metadata.trackingPrefix)},
  formId: ${jsValue(compiled.metadata.formId)},
  version: ${jsValue(compiled.metadata.version)},
  title: ${jsValue(compiled.metadata.plainLanguageHeader)},
  subTitle: ${jsValue(compiled.metadata.subTitle)},
  defaultDefinitions: {},
  saveInProgress: {},
  prefillEnabled: ${jsValue(compiled.metadata.prefillEnabled)},
${prefillTransformer}
  ${hasChapterConditions ? 'formOptions: { enableChapterDepends: true },' : ''}
${transformForSubmit}
  chapters: {
${indent(chapters, 4)}
  },
};

export default formConfig;
`;
}
