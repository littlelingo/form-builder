# VA Form Builder

Standalone foundation for a low-code form builder.

> **Using the builder?** See the [end-user guide](docs/user-guide/README.md) — task-oriented walkthrough of every panel, field, condition, handler, and setting for non-engineer form authors.

This package intentionally lives outside `vets-website-main`. It does not modify VA source, and the builder UI does not use VA.gov Design System components. It provides:

- A versioned authoring schema contract.
- A deterministic compiler from authoring JSON to generated `formConfig` module code.
- A declarative rule engine for preview and generated code.
- Declarative dynamic validations and computed values.
- A component-system catalog with USWDS CSS as the primary preview target and shadcn-style styling as an optional comparison target.
- Compatibility/audit diff utilities for schema versioning.
- Representative authoring examples, including 21-4140 with list-loop, prefill, and file upload, and 27-8832 with Chapter 36 claimant conditions and certification flow.

## Commands

```bash
npm install
npm test
npm run compile:example
npm run compile:example:27-8832
npm run builder:dev
npm run builder:build
```

The compiler and audit utilities have no runtime third-party dependencies. The builder UI is a React/Vite workspace app and uses USWDS CSS for the primary preview.

## Local LLM (Ollama in Docker)

Container-based local LLM for the PDF importer (see `pdf-import-and-standards.md`). Default provider per plan; portable across hosts.

```bash
npm run llm:up           # start Ollama container (detached)
npm run llm:pull         # pull llama3.1:8b (override: MODEL=qwen2.5:14b npm run llm:pull)
npm run llm:pull:qwen    # pull qwen2.5:14b (better quality, ~9GB)
npm run llm:smoke        # JSON-mode endpoint test against llama3.1:8b
npm run llm:status       # container state + pulled models
npm run llm:logs         # tail container logs
npm run llm:down         # stop + remove container; named volume `ollama_models` preserved
```

### Destroying pulled models

`npm run llm:down` keeps the `ollama_models` named volume so re-`up` is instant. To wipe pulled models and reclaim disk (forces re-pull on next start):

```bash
docker compose -f docker-compose.ollama.yml down -v
```

Not scripted on purpose. Re-downloading `qwen2.5:14b` is ~9GB. Only run when intentionally resetting state.

### Importer env vars

```bash
export IMPORT_LLM_PROVIDER=ollama
export IMPORT_LLM_MODEL=llama3.1:8b
export IMPORT_LLM_BASE_URL=http://localhost:11434
```

Mac perf note: Docker Ollama is CPU-only on macOS (no Metal passthrough). For faster local inference on Apple Silicon, install Ollama natively (`brew install ollama`) and skip the container — same env vars apply.

## Builder App

The first UI shell lives in `apps/builder`.

Implemented builder features:

- Form metadata editing.
- Prefill mapping editing.
- JSON import/export.
- Example loading from the Files panel for 21-4140 and 27-8832 authoring JSON.
- Draggable component toolbox.
- Draggable section and screen templates for common form structure.
- Canvas drop zones for adding and reordering fields.
- In-canvas field remove and duplicate actions.
- Side-drop layout behavior for placing fields in two-column rows.
- Layout controls for full-row, two-column, three-column, and explicit row starts.
- Common builder toolbar for undo/redo, adding chapters/pages, and switching workspace views.
- Explicit canvas edit/preview modes, with drag/drop and field actions locked in preview mode.
- Chapter/page/field navigation.
- Chapter and page creation/removal.
- Chapter and page editing.
- Chapter, page, and field ordering controls.
- USWDS CSS component palette.
- Field label, ID, hint, required, option, and file-upload endpoint editing.
- Visual condition editing for chapter, page, field visibility, and dynamic required behavior, including nested all/any branching.
- List-loop chapter settings for nouns, array path, max items, required behavior, item label, and intro text.
- USWDS and shadcn-style preview target switch.
- Live sample-answer preview data that drives conditional visibility and dynamic required behavior.
- Computed-value preview output alongside raw sample answers.
- Live authoring JSON and generated `formConfig` output.
- Audit panel showing validation and compatibility changes from the loaded baseline.

## Current Scope

Implemented component mappings:

- `textInput`
- `textArea`
- `date`
- `radioButton`
- `select`
- `checkbox`
- `fileUpload`
- `address`
- `phone`
- `email`
- `yesNo`

Implemented flow support:

- Standard chapters/pages.
- List-loop chapters generated through `arrayBuilderPages`.
- Declarative page and field conditions.
- Dynamic required rules.
- Declarative validation rules.
- Computed values applied during generated submit transforms.
- Prefill metadata, generated `prefillEnabled` flag, and declarative prefill mappings.
- Customizable `submitUrl`.

## Component Systems

The authoring schema uses semantic component types, not implementation-specific JSX. Targets are mapped in `src/component-systems/componentSystems.mjs`.

- `uswds`: Primary preview and builder target using USWDS form controls such as text input, textarea, radio buttons, select, checkbox, and file input.
- `vaFormsSystem`: Existing generated `formConfig` target using forms-system helper imports such as `textUI`, `selectUI`, `fileInputUI`, and `arrayBuilderPages`. This remains as an output target for now and is separate from the builder UI component stack.
- `shadcn`: Optional preview/builder comparison target using shadcn-style component mappings such as `Field`, `Input`, `Textarea`, `Checkbox`, `RadioGroup`, and `Select`.

## Design Principle

The saved source of truth is authoring JSON. Generated code is an output artifact.

Do not store raw `formConfig` as the authoring source because it requires executable JavaScript and React components.
