import fewshotData from './fewshot.json' with { type: 'json' };
import { SYSTEM_PROMPT } from './system.mjs';

export function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

export function getFewShotExamples() {
  return fewshotData.examples || [];
}

export function buildUserMessage(payload) {
  const examples = getFewShotExamples();
  const exampleText = examples
    .map(
      (ex, i) =>
        `### Example ${i + 1}\nINPUT:\n${JSON.stringify(ex.input)}\nOUTPUT:\n${JSON.stringify(ex.output)}`,
    )
    .join('\n\n');

  return `${exampleText}\n\n### Now enrich this input. Output JSON only.\nINPUT:\n${JSON.stringify(payload)}\nOUTPUT:`;
}
