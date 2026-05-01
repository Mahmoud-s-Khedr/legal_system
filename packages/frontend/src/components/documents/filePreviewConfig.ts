export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const FILE_PREVIEW_SUPPORTED_MIME = {
  pdf: "application/pdf",
  docx: DOCX_MIME
} as const;

export const FILE_PREVIEW_LIMITS_BYTES = {
  pdf: 250 * 1024 * 1024,
  image: 200 * 1024 * 1024,
  docx: 150 * 1024 * 1024
} as const;

// Desktop bootstrap/connection checks can add startup latency before fetch starts.
// Keep this generous to avoid false preview failures.
export const FILE_PREVIEW_TIMEOUT_MS = 90_000;

export function resolvePreviewKind(mimeType: string): "pdf" | "image" | "docx" | "unsupported" {
  if (mimeType === FILE_PREVIEW_SUPPORTED_MIME.pdf) {
    return "pdf";
  }
  if (mimeType === FILE_PREVIEW_SUPPORTED_MIME.docx) {
    return "docx";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  return "unsupported";
}

export function resolvePreviewLimitBytes(kind: "pdf" | "image" | "docx" | "unsupported") {
  switch (kind) {
    case "pdf":
      return FILE_PREVIEW_LIMITS_BYTES.pdf;
    case "image":
      return FILE_PREVIEW_LIMITS_BYTES.image;
    case "docx":
      return FILE_PREVIEW_LIMITS_BYTES.docx;
    default:
      return null;
  }
}
