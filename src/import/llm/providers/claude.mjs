// Claude (Anthropic) provider — opt-in. Requires ANTHROPIC_API_KEY.
// Uses prompt caching: stable system prompt cached for repeat imports.
//
// Lazy-imports @anthropic-ai/sdk so missing dep doesn't break other providers.

import { buildUserMessage, getSystemPrompt } from '../prompts/index.mjs';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

function getModel() {
  return process.env.IMPORT_LLM_MODEL || DEFAULT_MODEL;
}

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  // /* @vite-ignore */ keeps Rollup from following this import at build time.
  // Anthropic SDK is server-only — browser path goes through apps/proxy/.
  const sdkName = '@anthropic-ai/sdk';
  const mod = await import(/* @vite-ignore */ sdkName);
  const Anthropic = mod.default || mod.Anthropic;
  cachedClient = new Anthropic({ apiKey: getApiKey() });
  return cachedClient;
}

export const claudeProvider = {
  name: 'claude',
  defaultModel: DEFAULT_MODEL,
  async isAvailable() {
    return !!getApiKey();
  },
  async enrich(payload, options = {}) {
    if (!getApiKey()) throw new Error('Claude provider requires ANTHROPIC_API_KEY');
    const client = await getClient();
    const system = getSystemPrompt();
    const user = buildUserMessage(payload);
    const model = options.model || getModel();

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: user }],
    });

    const block = response.content?.find(c => c.type === 'text');
    if (!block?.text) throw new Error('Claude enrich returned no text content');
    let json = block.text.trim();
    // Strip code-fence wrappers if model added them.
    json = json.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.fields)) {
      throw new Error('Claude response missing fields array');
    }
    return { fields: parsed.fields };
  },
};
