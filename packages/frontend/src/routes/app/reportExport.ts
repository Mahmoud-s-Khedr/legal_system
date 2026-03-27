import { apiDownload } from "../../lib/api";

export async function downloadReportFile(path: string, fallbackFilename: string) {
  const { blob, filename } = await apiDownload(path);
  const downloadUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = filename ?? fallbackFilename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(downloadUrl);
  }
}
