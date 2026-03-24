import type { DocumentType, ExtractionStatus, OcrBackend } from "../enums/index.js";

export interface DocumentVersionDto {
  id: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
  storageKey: string;
  createdAt: string;
}

export interface DocumentDto {
  id: string;
  firmId: string;
  caseId: string | null;
  clientId: string | null;
  uploadedById: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  type: DocumentType;
  extractionStatus: ExtractionStatus;
  ocrBackend: OcrBackend;
  contentText: string | null;
  versions: DocumentVersionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentDto {
  title: string;
  type: DocumentType;
  caseId?: string;
  clientId?: string;
}

export interface UpdateDocumentDto {
  title?: string;
  type?: DocumentType;
  caseId?: string | null;
  clientId?: string | null;
}

export interface DocumentListResponseDto {
  items: DocumentDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentSearchResultDto {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  type: DocumentType;
  extractionStatus: ExtractionStatus;
  caseId: string | null;
  clientId: string | null;
  headline: string;
  rank: number;
  createdAt: string;
}

export interface DocumentSearchResponseDto {
  items: DocumentSearchResultDto[];
  total: number;
  query: string;
}

export interface DocumentDownloadDto {
  url: string;
  expiresAt: string | null;
}
