import { buildUserMessage, getSystemPrompt } from '../prompts/index.mjs';

const DEFAULT_BASE_URL = 'http://localhost:8000/v1';
const DEFAULT_MODEL = 'qwen2.5:14b';

function getBaseUrl() {
  return process.env.IMPORT_LLM_BASE_URL || DEFAULT_BASE_URL;
}

function getModel() {
  return process.env.IMPORT_LLM_MODEL || DEFAULT_MODEL;
}

function getApiKey() {
  return process.env.IMPORT_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
}

export const openaiCompatibleProvider = {
  name: 'openai-compatible',
  defaultModel: DEFAULT_MODEL,
  async isAvailable() {
    try {
      const res = await fetch(`${getBaseUrl()}/models`, {
        headers: getApiKey() ? { Authorization: `Bearer ${getApiKey()}` } : {},
      });
      return res.ok;
    } catch {
      return false;
    }
  },
  async enrich(payload, options = {}) {
    const baseUrl = options.baseUrl || getBaseUrl();
    const model = options.model || getModel();
    const apiKey = options.apiKey || getApiKey();
    const system = getSystemPrompt();
    const user = buildUserMessage(payload);

    const body = {
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`openai-compatible enrich failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('openai-compatible: empty content');
    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.fields)) {
      throw new Error('openai-compatible response missing fields array');
    }
    return { fields: parsed.fields };
  },
};
