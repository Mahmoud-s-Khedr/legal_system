const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";

type DesktopDownloadSettingsCommandResult =
  | { ok: true; effectivePath: string; configuredPath?: string | null; changed?: boolean }
  | { ok: false; code: string };

type DesktopSaveDownloadCommandResult =
  | { ok: true; path: string }
  | { ok: false; code: string };

export interface DesktopDownloadSettings {
  effectivePath: string;
  configuredPath: string | null;
}

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

function mapDesktopDownloadError(code: string) {
  switch (code) {
    case "DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE":
      return "Desktop download settings are unavailable.";
    case "DESKTOP_DOWNLOAD_PATH_INVALID":
      return "The selected download path is invalid.";
    case "DESKTOP_DOWNLOAD_SAVE_FAILED":
      return "Saving the downloaded file failed.";
    default:
      return "Desktop download operation failed.";
  }
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function toSettings(result: Extract<DesktopDownloadSettingsCommandResult, { ok: true }>): DesktopDownloadSettings {
  return {
    effectivePath: result.effectivePath,
    configuredPath: result.configuredPath ?? null
  };
}

export async function saveBlobToDownloads(blob: Blob, filename: string): Promise<string | null> {
  if (!isDesktopShell) {
    triggerBrowserDownload(blob, filename);
    return null;
  }

  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  const result = await invokeDesktop<DesktopSaveDownloadCommandResult>("desktop_save_download_file", {
    filename: normalizeFilename(filename),
    bytes
  });

  if (!result.ok) {
    throw new Error(mapDesktopDownloadError(result.code));
  }

  return result.path;
}

export async function saveTextToDownloads(
  text: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
) {
  return saveBlobToDownloads(new Blob([text], { type: mimeType }), filename);
}

export async function getDesktopDownloadSettings(): Promise<DesktopDownloadSettings | null> {
  if (!isDesktopShell) {
    return null;
  }

  const result = await invokeDesktop<DesktopDownloadSettingsCommandResult>("desktop_get_download_settings");
  if (!result.ok) {
    throw new Error(mapDesktopDownloadError(result.code));
  }

  return toSettings(result);
}

export async function chooseDesktopDownloadDirectory(): Promise<DesktopDownloadSettings | null> {
  if (!isDesktopShell) {
    return null;
  }

  const result = await invokeDesktop<DesktopDownloadSettingsCommandResult>("desktop_choose_download_directory");
  if (!result.ok) {
    throw new Error(mapDesktopDownloadError(result.code));
  }

  return toSettings(result);
}

export async function resetDesktopDownloadDirectory(): Promise<DesktopDownloadSettings | null> {
  if (!isDesktopShell) {
    return null;
  }

  const result = await invokeDesktop<DesktopDownloadSettingsCommandResult>("desktop_reset_download_directory");
  if (!result.ok) {
    throw new Error(mapDesktopDownloadError(result.code));
  }

  return toSettings(result);
}

export function isDesktopDownloadsEnabled() {
  return isDesktopShell;
}
