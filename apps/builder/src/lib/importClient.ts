import { importPdf } from '../../../../src/import/pipeline.mjs';
import type { AuthoringForm } from '../types';
import { configurePdfJsWorker } from './pdfjsWorker';

export type ImportProgressStage =
  | 'file-read'
  | 'fingerprint'
  | 'extract-acroform'
  | 'extract-text'
  | 'form-inventory'
  | 'pair-labels'
  | 'corpus'
  | 'enrichment'
  | 'component-patterns'
  | 'curation'
  | 'build-authoring'
  | 'validate'
  | 'complete';

export interface ImportCurationDecision {
  type: 'listLoop';
  source: string;
  recipeId?: string | null;
  chapterId: string;
  chapterTitle: string;
  pageId: string;
  pageTitle: string;
  arrayPath?: string | null;
  nounSingular?: string | null;
  nounPlural?: string | null;
  sourceFieldCount: number;
  itemFieldIds: string[];
  itemFieldLabels: string[];
  itemFieldCount: number;
  estimatedItemCount?: number | null;
}

export interface ImportCurationReport {
  status: string;
  recipe?: {
    status: string;
    recipeId?: string | null;
    recipeName?: string | null;
    matchedFieldCount: number;
  };
  corpus?: {
    matchedFieldCount: number;
  };
  decisions?: ImportCurationDecision[];
  curatedFieldCount: number;
  totalFieldCount: number;
  recipeCatalogVersion?: string | null;
}

export interface ImportDetectedForm {
  formNumber: string;
  revisions: string[];
  pages: number[];
  pageRanges: string[];
  evidence: string[];
}

export interface ImportFormInventoryDetection {
  page: number;
  formNumber: string;
  revision?: string | null;
  confidence: number;
  evidence: string;
}

export interface ImportFormInventoryReport {
  status: 'none-detected' | 'single-form' | 'multi-form';
  detectedFormCount: number;
  filename?: string | null;
  formId?: string | null;
  forms: ImportDetectedForm[];
  pageDetections: ImportFormInventoryDetection[];
  warnings: string[];
}

export interface ImportPatternReport {
  taxonomyVersion?: string;
  mode?: 'deterministic' | 'hybrid';
  matchedFieldCount: number;
  totalFieldCount: number;
  unmatchedFieldCount: number;
  coverageRatio: number;
  roleCounts: Record<string, number>;
  familyCounts?: Record<string, number>;
  sourceCounts?: Record<string, number>;
  unmatchedSummary?: {
    topTokens: Array<{ token: string; count: number }>;
    sampleFields: Array<{ name: string | null; label: string | null }>;
  };
}

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
  curation?: ImportCurationReport;
  formInventory?: ImportFormInventoryReport;
  patterns?: ImportPatternReport;
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
    curation?: ImportCurationReport;
    formInventory?: ImportFormInventoryReport;
    patterns?: ImportPatternReport;
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
  return result as unknown as ImportPdfResult;
}
