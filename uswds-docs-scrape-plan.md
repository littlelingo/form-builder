# Plan: `uswdsDocsScrape.mjs` (V1.5 standards source)

## Context

`pdf-import-and-standards.md` §593–596 lists `uswdsDocsScrape.mjs` as a deferred V1.5 backlog item: a refresh script that derives accessibility + content rules from the local USWDS package and emits a JSON source file the standards engine can merge.

The plumbing is already in place:
- `src/standards/priority.mjs:1` — `DEFAULT_PRIORITY_ORDER = ['external', 'uswdsDocs', 'vetsWebsiteScrape', 'builtIn']` already reserves the `uswdsDocs` slot above `builtIn`.
- `src/standards/index.mjs:11` — `loadDefaultStandards` only loads `builtIn` today; second source must be added here.
- `mergeRules` (priority.mjs) merges by rule `id` so a `uswdsDocs.*` rule never collides with the `va.*` namespace.

Why now: the V1 audit catches structural / VA-metadata issues but no USWDS-specific accessibility content (label/legend/error-message pairing, fieldset use for radio/checkbox groups, character-count maxlength, hint text patterns). Those are exactly what designsystem.digital.gov enforces.

## Sequence relative to other V1.5 work

Pull this item up **after** `vetsWebsiteScrape.mjs`, not before. Reasoning:

- `vetsWebsiteScrape.mjs` derives rules from real production VA forms — highest signal-per-rule of any source, validates `priority.mjs` multi-source merge under real load before USWDS layers in on top.
- USWDS docs are stable; `builtIn.json` already hand-curates the high-value subset for V1. This source is preventive (catches things V1 doesn't, but rarely), not curative.
- Order also matches `DEFAULT_PRIORITY_ORDER`: external > uswdsDocs > vetsWebsiteScrape > builtIn. Building bottom-up surfaces priority-resolution bugs earlier.

If V1 ships and pilot regression tests pass cleanly without this source, defer further. Trigger to pull forward: builder-generated forms start failing USWDS audits in downstream CI, or authors complain that obvious a11y gaps slip past the V1 audit.

## Why standards-layer, not LLM context

USWDS knowledge could in principle be injected into the LLM enricher's system prompt or a Modelfile. Don't. Reasons:

- **Determinism.** Standards rules are pure-data predicates evaluated by `audit.mjs` — fully testable, reproducible across runs, no token cost. LLM context is fuzzy and varies per call.
- **Versioning.** A scraped JSON file diffs cleanly on USWDS upgrade in PR review. Prompt-baked knowledge hides changes inside model behavior.
- **Layering.** LLM is for fuzzy classification (PDF field → component type, label cleanup). Rules are for `if/else` checks. USWDS a11y patterns are the latter — they're rules, not judgment calls.
- **Cost.** Every call to the enricher would carry the USWDS knowledge tokens. Standards layer evaluates once, post-hoc, free.

Modelfile system prompt remains the right home for **voice/style** guidance (sentence case, hint phrasing) that resists rule-encoding. That stays scoped to the M5 prompt template, not this source.

## Recommended Approach

Add a build-time refresh script that walks the locally installed `@uswds/uswds` package twig templates, derives a small, hand-curated rule set, and writes `src/standards/sources/uswdsDocs.json`. Standards index loads the JSON if present (lazy/optional), so missing file = no failure.

### 1. Refresh script — `src/standards/sources/uswdsDocsScrape.mjs`

Responsibilities:
- Resolve `node_modules/@uswds/uswds/packages/` (use `import.meta.resolve` or `createRequire` + `path.dirname` of `@uswds/uswds/package.json`).
- For each known component dir (allowlist, not glob-everything): read `src/*.twig`, parse with regex for marker classes/attributes (`usa-label[ for=]`, `usa-error-message`, `usa-fieldset`, `usa-character-count`, `aria-describedby`, `aria-required`, `role="alert"`).
- Map markers to authoring-schema component types via `componentRegistry.mjs` + `componentSystems.mjs` (e.g. `radio`/`checkbox` → must live inside a fieldset → label rule; `textInput` with `maxlength` → must declare character-count hint; `fileUpload` → accept attribute).
- Stamp output with the installed USWDS version (read from `node_modules/@uswds/uswds/package.json`) plus `generatedAt`.
- Write `src/standards/sources/uswdsDocs.json` (same shape as `builtIn.json`: `{ version, rules: [...] }`).
- Each rule id prefixed `uswds.` (e.g. `uswds.a11y.label-required`, `uswds.a11y.fieldset-required-for-group`, `uswds.content.error-message-role-alert`, `uswds.content.character-count-hint`).
- Severity: a11y violations = `error`, content/quality = `warning`, prefer-style = `info`.

Keep the rule set small (10–20 rules) and curated. Twig parsing is a *prompt* for which rules to emit, not an automated rule synthesizer — the script's value is keeping the curated list versioned against the USWDS release we install.

### 2. Generated source — `src/standards/sources/uswdsDocs.json`

Committed to repo (deterministic, reviewable diff on USWDS upgrade). Same JSON shape as `src/standards/sources/builtIn.json:1`.

### 3. Wire into runtime — `src/standards/index.mjs`

Change `loadDefaultStandards` to also load `uswdsDocs`:

```js
import { existsSync, readFileSync } from 'node:fs';
// ...
function loadUswdsDocsRules() {
  const url = new URL('./sources/uswdsDocs.json', import.meta.url);
  if (!existsSync(url)) return [];
  return JSON.parse(readFileSync(url, 'utf8')).rules || [];
}

export function loadDefaultStandards(priorityOrder = DEFAULT_PRIORITY_ORDER) {
  const sourceMap = {
    builtIn: loadBuiltInRules(),
    uswdsDocs: loadUswdsDocsRules(),
  };
  return loadStandardsFromMap(sourceMap, priorityOrder);
}
```

Optional load = no breakage if someone deletes the JSON or runs before the script.

### 4. CLI entry — `package.json`

Add script:
```json
"standards:refresh:uswds": "node src/standards/sources/uswdsDocsScrape.mjs"
```

No new runtime dependencies — twig parsing is regex-only, USWDS package is already installed.

### 5. Predicate vocabulary — verify coverage in `src/standards/predicate.mjs`

Most rules will reuse existing ops. Two likely gaps to confirm before scripting:
- **Group-context predicate** (e.g. radio inside a fieldset): can be expressed by adding a `parent` traversal field to scope, or by re-scoping the rule to `chapter`/`page` and using `everyComponentHas { where: ... }`. Prefer the latter — no engine change.
- **Component sibling check** (character-count needs an associated hint): reuse `anyComponentHas` at page scope.

If a real need surfaces during scripting, add the predicate op alongside the rule that needs it — don't invent ops speculatively.

### 6. Tests — `tests/standards.test.mjs`

Add tests:
- `loadDefaultStandards` returns `sources` including `uswdsDocs` when JSON present.
- `mergeRules` priority: a `uswdsDocs` rule with same id as a `builtIn` rule wins (already covered by existing `external` test pattern — extend to `uswdsDocs`).
- The two retro-stamped examples (`examples/21-4140-authoring.json`, `examples/27-8832-authoring.json`) still produce zero blockers after `uswdsDocs` rules are layered in. This is the regression guard — if a uswds rule misfires on a known-good form, refine the rule.

### 7. Docs

- Update `pdf-import-and-standards.md` §593–596: move the `uswdsDocsScrape.mjs` bullet from "deferred" to a brief "Implemented" note.
- Add a one-paragraph README in `src/standards/sources/` describing the source files, refresh cadence, and the rule-id namespace convention (`uswds.*` vs `va.*`).

## Critical Files

- `src/standards/sources/uswdsDocsScrape.mjs` — new
- `src/standards/sources/uswdsDocs.json` — new (generated, committed)
- `src/standards/index.mjs` — extend `loadDefaultStandards`
- `src/standards/predicate.mjs` — confirm vocabulary; add op only if needed
- `tests/standards.test.mjs` — add multi-source + regression tests
- `package.json` — add `standards:refresh:uswds`
- `pdf-import-and-standards.md` — update backlog status

## Reused Pieces

- `mergeRules` / `loadStandards` (`src/standards/priority.mjs`) — no changes required.
- `evaluatePredicate` (`src/standards/predicate.mjs`) — vocabulary already covers most rules.
- `componentRegistry.mjs`, `src/component-systems/componentSystems.mjs` — type allowlist when mapping USWDS components to authoring-schema component types.
- `builtIn.json` shape — uswdsDocs.json is identical, no schema diverge.

## Verification

1. `npm run standards:refresh:uswds` — produces deterministic `uswdsDocs.json`; second run yields same file (modulo `generatedAt`, which can be stamped from USWDS package version only to keep diffs clean).
2. `npm test` — all standards tests pass, including new ones.
3. `node src/cli/compile.mjs examples/21-4140-authoring.json` and `examples/27-8832-authoring.json` — still zero blockers.
4. Manual: temporarily break a known authoring example (remove a fieldset around a radio group), re-run audit, confirm a `uswds.a11y.*` finding fires with correct `componentId`.
5. Builder UI: open standards panel for an example form, confirm `uswdsDocs` appears in the source list and rule findings (if any) render with the new source label.

## Open Questions (none blocking)

- **Scope: twig-only vs. uswds-site markdown.** Twig templates ship with the npm package (zero new deps). The richer content-style guidance lives in the separate `uswds/uswds-site` repo (markdown). Recommend twig-only for V1.5; a follow-up could git-submodule or HTTP-fetch uswds-site if content rules need expansion.
- **Generated file vs. runtime parsing.** Recommend committing `uswdsDocs.json` so PR reviewers see rule diffs on USWDS upgrade. Runtime parsing would hide changes inside a `npm install` bump.
