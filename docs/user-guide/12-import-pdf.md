# 12. Import a PDF

If you already have a fillable VA PDF (an **AcroForm**), you don't have to recreate it field by field. The builder will extract the fields and assemble an authoring JSON for you — usually in under a minute.

> **Heads-up:** PDF import works best on AcroForm PDFs (PDFs with embedded form fields). Scanned-image PDFs without form fields don't have data to extract; the importer falls back on text extraction but results are weaker.

<!-- TODO: screenshot — Import PDF button in header strip -->

## Start the import

1. In the header strip, click **Import PDF**.
2. Choose the PDF file from your computer.
3. The progress modal appears, listing each pipeline stage.

## Pipeline stages

You'll see a progress bar walk through these steps:

| Stage | What it does |
|-------|--------------|
| **Fingerprint** | Hash the PDF for caching and dedup. |
| **Extract AcroForm** | Read the embedded form fields. |
| **Extract text** | Read page text and layout positions. |
| **Label pairing** | Match each PDF input to its visible label. |
| **Field consolidation** | Merge split fields (SSN halves, date parts, address pieces). |
| **Corpus matching** | Look up known recipes from previously imported forms. |
| **Enrichment** | (Optional) ask a local or cloud LLM to improve labels and classifications. |
| **Build JSON** | Assemble the authoring JSON. |
| **Validate** | Check schema validity. |
| **Load canvas** | Drop the result into the Canvas. |

If any stage fails, the modal shows the error and lets you abort. Most failures are PDFs without an AcroForm — switch to manual authoring or talk to your engineer about a CLI-side conversion.

## After import — the Review panel

Imported components arrive with a **confidence score** per field — *high*, *medium*, or *low*. The right panel automatically opens the **Review** tab.

| Confidence | Meaning |
|------------|---------|
| **High** | Pulled cleanly from the AcroForm; rare to need correction. |
| **Medium** | Best-effort from text + layout; eyeball it. |
| **Low** | Uncertain — review carefully or rewrite. |

The Review panel lets you:

- See each component with its badge.
- **Accept** a component (mark as reviewed).
- **Reject** a component (delete it from the form).
- **Edit** in place — change the label, hint, type, etc., then accept.
- **Accept all** — bulk-approve the imports you've spot-checked.
- **Promote recipe** — save the structure of this import as a reusable recipe. Future imports of similar PDFs will recognize the pattern and start with higher confidence.

## Optional: LLM enrichment

The importer can call a language model to improve labels (e.g., turn `nm_svc_ben` into *Service member benefits*) and infer field types. This is configured by your engineer via environment variables — see [`docs/import-llm-providers.md`](../import-llm-providers.md).

Three options at a glance:

- **None** — fast, deterministic, baseline.
- **Local Ollama** (`llama3.1:8b` or `qwen2.5:14b`) — runs on the engineer's machine; private; no API cost.
- **Cloud Claude** — strongest quality; requires `ANTHROPIC_API_KEY`; opt-in.

You don't pick at import time — the engineer sets it up once and every import uses the configured provider.

## Edit and keep building

Once accepted, an imported form behaves exactly like one you built by hand. Drag-drop, conditions, validations, all of it. The original AcroForm origin is recorded in each component's **provenance** metadata (visible if you inspect the JSON) — useful for auditing.

## Tips

- **Re-import is idempotent.** The fingerprint stage skips work for an unchanged PDF, so re-importing a slightly tweaked PDF is fast.
- **Promote a recipe early.** If the form you're importing has siblings (say, all Form 21-* employment series), promote the recipe so the next sibling import is cleaner.
- **Don't trust low-confidence labels.** They're guesses. Always read low-confidence fields end-to-end before accepting.
- **Keep the original PDF.** The CLI sidecars a copy on import (`source.pdf`); for browser imports, store the source PDF alongside the resulting authoring JSON so future-you can re-run.

## Batch import (engineer-side)

For folders of PDFs, the engineer can run:

```bash
node src/cli/import.mjs <pdf>           # single file → authoring JSON
npm run import:corpus -- <folder> --markdown build/report.md   # batch
```

See [`pdf-import-and-standards.md`](../../pdf-import-and-standards.md) at the project root for the engineer's guide.

## Related

- [Save, export, publish](13-save-export-publish.md)
- [Standards audit](14-standards-audit.md) — run after import to catch low-quality labels.
- [Templates and examples](15-templates.md) — recipes you've promoted live alongside templates.
