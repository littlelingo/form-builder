# LLM Enricher — Provider Setup

The PDF importer uses an optional LLM pass to clean labels, classify component types, and add hints. The provider is pluggable.

## Defaults

- Provider: `ollama` (local, no key, no per-call cost)
- Model: `qwen2.5:14b` (best structured-output quality at ~9 GB) or `llama3.1:8b` (~5 GB floor)
- Temperature: 0
- JSON-mode output (provider-specific)
- Fields chunked at 25/batch to fit local context windows
- Per-batch timeout: 240 s

## Selecting a provider

Set environment variables before running the importer:

```
IMPORT_LLM_PROVIDER=ollama|openai-compatible|claude|mock
IMPORT_LLM_MODEL=<model id>
IMPORT_LLM_BASE_URL=<override URL for ollama / openai-compatible>
ANTHROPIC_API_KEY=<key>          # only for claude
IMPORT_LLM_API_KEY=<key>         # only for openai-compatible (also reads OPENAI_API_KEY)
```

## Provider notes

### `ollama` (default, recommended)

Local. Privacy: all data stays on the machine. No per-call cost.

```
docker compose -f docker-compose.ollama.yml up -d
docker exec -it form-builder-ollama ollama pull qwen2.5:14b
```

Run the importer:

```
node src/cli/import.mjs ./your-form.pdf --out ./build/your-form
```

Pilot test gated on local Ollama reachable at `http://localhost:11434`.

### `openai-compatible`

Generic OpenAI-style chat completions endpoint. Works with LM Studio, llama.cpp server, vLLM, LocalAI.

```
IMPORT_LLM_PROVIDER=openai-compatible \
IMPORT_LLM_BASE_URL=http://localhost:1234/v1 \
IMPORT_LLM_MODEL=Qwen2.5-14B-Instruct-Q4 \
node src/cli/import.mjs ./your-form.pdf --out ./build/your-form
```

### `claude` (cloud, opt-in)

Anthropic SDK. Requires `ANTHROPIC_API_KEY`. Privacy: extracted PDF text + field labels go to a third party. Only use after explicit governance approval.

```
ANTHROPIC_API_KEY=sk-ant-... \
IMPORT_LLM_PROVIDER=claude \
node src/cli/import.mjs ./your-form.pdf --out ./build/your-form
```

Anthropic SDK is dynamically imported only when `claude` is selected, so it never lands in the browser bundle.

### `mock`

Deterministic stub provider. Used by tests in CI. Safe with no models, no network, no keys.

```
IMPORT_LLM_PROVIDER=mock node src/cli/import.mjs ./your-form.pdf --out ./build/your-form
```

## Privacy posture

Default is local. Switching to cloud Claude sends extracted PDF text + field labels to a third party. Document this in your project README and require explicit opt-in via env var.

## Browser path

V1 ships server/CLI-only enrichment. Browser-side `Import PDF` action runs the deterministic extract + corpus lookup but does **not** call an LLM provider. To enable browser-side enrichment, ship `apps/proxy/` (planned) that brokers requests to the configured provider. Local Ollama still runs server-side via the proxy in that mode.

## Caching

Successful enricher output is cached at `.cache/import/<key>.json`. Key:

```
sha256({ pdfHash, promptVersion, providerName, modelId })
```

Cache invalidates automatically when:

- Prompt version bumps in `src/import/llm/provider.mjs::ENRICHER_PROMPT_VERSION`
- Provider or model changes
- PDF bytes change

Disable per-call with `useCache: false` (the test suite does this).

## Token budget

Hard caps:

- Input: 30 000 tokens (per call)
- Output: 8 000 tokens (per call)

Fields are chunked at 25/batch before reaching either cap. If a single batch still overflows, the enricher returns `reason: 'token-cap-exceeded'` and the importer falls back to deterministic + corpus output.

## Failure modes

The pipeline never blocks on enricher failure. On any error the importer logs a reason on `importReport.enrichment` and uses deterministic + corpus output:

- `provider-unavailable` — `isAvailable()` returned false (model not pulled, no key, server unreachable)
- `provider-error` — provider call threw (timeout, network, parse, invalid JSON)
- `token-cap-exceeded` — input too large
- `disabled` — `enrich: false` passed to `importPdf`
- `cache-hit` — read from `.cache/import/`
- `success` — fresh enrichment

## Roadmap

- `apps/proxy/` minimal Express proxy for browser-side enrichment (M5 stretch)
- Embedding-based exemplar similarity in corpus (V1.5)
- Per-field re-enrichment when author edits in inspector (V2)
- Auto-batch size based on model context window (V2)
