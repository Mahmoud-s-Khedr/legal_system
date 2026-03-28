import { apiDownload } from "../../lib/api";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";

export async function downloadReportFile(path: string, fallbackFilename: string) {
  const { blob, filename } = await apiDownload(path);
  await saveBlobToDownloads(blob, filename ?? fallbackFilename);
}
