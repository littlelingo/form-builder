import { buildUserMessage, getSystemPrompt } from '../prompts/index.mjs';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:14b';

function getBaseUrl() {
  return process.env.IMPORT_LLM_BASE_URL || DEFAULT_BASE_URL;
}

function getModel() {
  return process.env.IMPORT_LLM_MODEL || DEFAULT_MODEL;
}

async function fetchTags() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/tags`, { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const ollamaProvider = {
  name: 'ollama',
  defaultModel: DEFAULT_MODEL,
  async isAvailable() {
    const tags = await fetchTags();
    if (!tags || !Array.isArray(tags.models)) return false;
    const model = getModel();
    return tags.models.some(m => m.name === model || m.model === model);
  },
  async enrich(payload, options = {}) {
    const model = options.model || getModel();
    const baseUrl = options.baseUrl || getBaseUrl();
    const system = getSystemPrompt();
    const user = buildUserMessage(payload);

    const body = {
      model,
      stream: false,
      format: 'json',
      options: {
        temperature: 0,
        num_ctx: 16384,
      },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 600_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama enrich failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    const content = data?.message?.content;
    if (!content) {
      throw new Error('Ollama enrich returned empty message content');
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error(`Ollama returned non-JSON: ${err.message}`);
    }
    if (!parsed || !Array.isArray(parsed.fields)) {
      throw new Error('Ollama response missing fields array');
    }
    return { fields: parsed.fields };
  },
};
