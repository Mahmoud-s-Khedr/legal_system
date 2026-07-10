function normalizeFilename(filename: string) {
  const value = filename.trim();
  return value.length > 0 ? value : "download.bin";
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = normalizeFilename(filename);
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(downloadUrl);
  }
}

export async function saveBlobToDownloads(blob: Blob, filename: string): Promise<string | null> {
  triggerBrowserDownload(blob, filename);
  return null;
}

export async function saveTextToDownloads(
  text: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
) {
  return saveBlobToDownloads(new Blob([text], { type: mimeType }), filename);
}
