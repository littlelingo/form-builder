// Provider interface contract. Each provider implements:
//
//   {
//     name: string,                          // 'ollama' | 'claude' | 'mock' | 'openai-compatible'
//     defaultModel: string,
//     async isAvailable(): boolean,
//     async enrich(payload, options): EnrichResult
//   }
//
// payload: {
//   formMetadata: { title, formId, ombNumber? },
//   fields: ExtractedField[],
//   exemplars?: Exemplar[]
// }
//
// EnrichResult: {
//   fields: EnrichedField[]   // one entry per input field with same fieldId
// }
//
// EnrichedField: {
//   fieldId,
//   label,
//   hint?,
//   type,                     // authoring component type
//   classificationCertainty,  // 0..1
//   validations?,
//   autocomplete?
// }

export const ENRICHER_PROMPT_VERSION = '2026.04.1';
