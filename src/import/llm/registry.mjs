import { claudeProvider } from './providers/claude.mjs';
import { mockProvider } from './providers/mock.mjs';
import { ollamaProvider } from './providers/ollama.mjs';
import { openaiCompatibleProvider } from './providers/openaiCompatible.mjs';

const PROVIDERS = {
  ollama: ollamaProvider,
  'openai-compatible': openaiCompatibleProvider,
  claude: claudeProvider,
  mock: mockProvider,
};

export function listProviders() {
  return Object.keys(PROVIDERS);
}

export function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown LLM provider "${name}". Known: ${listProviders().join(', ')}`);
  }
  return provider;
}

export async function selectProvider(preferredName) {
  const requested = preferredName || process.env.IMPORT_LLM_PROVIDER || 'ollama';
  const provider = getProvider(requested);
  const available = await provider.isAvailable();
  return { provider, available, requested };
}

export { PROVIDERS };
