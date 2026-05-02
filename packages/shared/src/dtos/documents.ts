import type { DocumentType, ExtractionStatus, OcrBackend, PreviewStatus } from "../enums/index.js";

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
  taskId: string | null;
  uploadedById: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  previewPdfKey?: string | null;
  previewStatus: PreviewStatus;
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
  taskId?: string;
}

export interface UpdateDocumentDto {
  title?: string;
  type?: DocumentType;
  caseId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
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
  taskId: string | null;
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

export interface DesktopPrinter {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface DesktopScanner {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface DesktopScanProfile {
  format: "pdf" | "tiff" | "png";
  source?: "device" | "file-picker";
  dpi?: number;
  colorMode?: "color" | "grayscale" | "bw";
}

export interface DesktopScanJobResult {
  scannerId: string;
  scannerName: string;
  fileName: string;
  mimeType: string;
  bytes: number[];
  source: "device" | "file-picker";
  actualFormat: "pdf" | "tiff" | "png";
  pageCount: number;
  provider: string;
}

export interface DocumentIoCapabilityItem {
  available: boolean;
  provider: string;
  reason?: string | null;
}

export interface DocumentIoCapability {
  isDesktop: boolean;
  print: DocumentIoCapabilityItem;
  scan: DocumentIoCapabilityItem;
}
