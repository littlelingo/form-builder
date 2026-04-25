import { importPdf } from '../../../../src/import/pipeline.mjs';
import type { AuthoringForm } from '../types';

export interface ImportPdfOptions {
  formId?: string;
  title?: string;
  importedBy?: string;
}

export interface ImportPdfResult {
  form: AuthoringForm;
  importReport: {
    pdfHash: string;
    pageCount: number;
    acroFormFieldCount: number;
    durationMs: number;
    validation: { valid: boolean; errors: string[]; warnings: unknown[] };
  };
}

export async function importPdfFromFile(
  file: File,
  options: ImportPdfOptions = {},
): Promise<ImportPdfResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const result = await importPdf(bytes, {
    filename: file.name,
    ...options,
  });
  return result as ImportPdfResult;
}
