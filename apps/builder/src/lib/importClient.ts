import { importPdf } from '../../../../src/import/pipeline.mjs';
import type { AuthoringForm } from '../types';
import { configurePdfJsWorker } from './pdfjsWorker';

export type ImportProgressStage =
  | 'file-read'
  | 'fingerprint'
  | 'extract-acroform'
  | 'extract-text'
  | 'pair-labels'
  | 'corpus'
  | 'enrichment'
  | 'build-authoring'
  | 'validate'
  | 'complete';

export interface ImportProgressEvent {
  stage: ImportProgressStage;
  detail: string;
  elapsedMs?: number;
  byteLength?: number;
  formId?: string;
  pdfHash?: string;
  pageCount?: number;
  pageNumber?: number;
  fieldCount?: number;
  pairedFieldCount?: number;
  corpusEntryCount?: number;
  corpusHits?: number;
  enrichment?: string;
  chapterCount?: number;
  componentCount?: number;
  validation?: { valid: boolean; errors: string[]; warnings: unknown[] };
}

export interface ImportPdfOptions {
  formId?: string;
  title?: string;
  importedBy?: string;
  onProgress?: (event: ImportProgressEvent) => void;
}

export interface ImportPdfResult {
  form: AuthoringForm;
  importReport: {
    pdfHash: string;
    pageCount: number;
    acroFormFieldCount: number;
    componentCount?: number;
    durationMs: number;
    validation: { valid: boolean; errors: string[]; warnings: unknown[] };
    corpusEntryCount?: number;
    corpusHits?: number;
    enrichment?: {
      provider: string;
      reason: string;
      cacheHit: boolean;
      tokenEstimate: number;
      error: string | null;
    };
  };
}

export async function importPdfFromFile(
  file: File,
  options: ImportPdfOptions = {},
): Promise<ImportPdfResult> {
  configurePdfJsWorker();
  options.onProgress?.({
    stage: 'file-read',
    detail: `Reading ${file.name} from disk.`,
    byteLength: file.size,
  });
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const result = await importPdf(bytes, {
    filename: file.name,
    // Browser imports currently run deterministic extraction only. LLM enrichment
    // remains CLI/server-side until the proxy path is shipped.
    enrich: false,
    ...options,
  });
  return result as ImportPdfResult;
}
