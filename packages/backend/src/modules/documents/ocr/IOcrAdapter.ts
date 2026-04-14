export interface OcrExtractionContext {
  documentId?: string;
  source?: "documents" | "library";
}

export interface IOcrAdapter {
  extract(buffer: Buffer, mimeType: string, context?: OcrExtractionContext): Promise<string>;
}
