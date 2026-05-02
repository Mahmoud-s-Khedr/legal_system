import type {
  DocumentIoCapability,
  DesktopPrinter,
  DesktopScanJobResult,
  DesktopScanProfile,
  DesktopScanner
} from "@elms/shared";

const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";

interface DesktopIoDefaults {
  defaultPrinterId?: string | null;
  defaultScannerId?: string | null;
}

function normalizeDesktopError(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }
  return String(error ?? "").replace(/^Error:\s*/i, "").trim();
}

function mapDesktopIoError(code: string) {
  const [rawCode, ...details] = code.split(":");
  const detail = details.join(":").trim();

  switch (rawCode) {
    case "DESKTOP_DOCUMENT_IO_UNAVAILABLE":
      return "Desktop document I/O is unavailable.";
    case "DESKTOP_DOCUMENT_IO_INVALID_INPUT":
      return "Invalid print or scan input.";
    case "DESKTOP_SCAN_CANCELLED":
      return "Scan was cancelled.";
    case "DESKTOP_SCAN_FAILED":
      return "Scanning failed.";
    case "DESKTOP_PRINT_FAILED":
      return "Printing failed.";
    case "NO_DEFAULT_PRINTER":
      return "No default printer is configured. Set a default printer and try again.";
    case "PRINTER_NOT_FOUND":
      return detail || "Selected printer was not found.";
    case "PRINT_COMMAND_MISSING":
      return "Printing command is not installed on this machine.";
    case "PRINT_COMMAND_FAILED":
      return detail || "Print command failed.";
    case "DESKTOP_PRINT_COMMAND_FAILED":
      return detail || "Printer discovery command failed.";
    default:
      return code || "Desktop document I/O operation failed.";
  }
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function ensureDesktop() {
  if (!isDesktopShell) {
    throw new Error("Desktop document I/O is only available in desktop mode.");
  }
}

export async function getDocumentIoCapability(): Promise<DocumentIoCapability> {
  if (!isDesktopShell) {
    return {
      isDesktop: false,
      print: { available: true, provider: "browser", reason: null },
      scan: {
        available: false,
        provider: "browser",
        reason: "Scanning is only available in desktop mode."
      }
    };
  }

  try {
    return await invokeDesktop<DocumentIoCapability>("desktop_get_document_io_capability");
  } catch (error) {
    const reason = mapDesktopIoError(normalizeDesktopError(error));
    return {
      isDesktop: true,
      print: { available: false, provider: "unknown", reason },
      scan: { available: false, provider: "unknown", reason }
    };
  }
}

export async function listDesktopPrinters(): Promise<DesktopPrinter[]> {
  ensureDesktop();
  try {
    return await invokeDesktop<DesktopPrinter[]>("desktop_list_printers");
  } catch (error) {
    throw new Error(mapDesktopIoError(normalizeDesktopError(error)));
  }
}

export async function listDesktopScanners(): Promise<DesktopScanner[]> {
  ensureDesktop();
  try {
    return await invokeDesktop<DesktopScanner[]>("desktop_list_scanners");
  } catch (error) {
    throw new Error(mapDesktopIoError(normalizeDesktopError(error)));
  }
}

export async function getDesktopDocumentIoDefaults(): Promise<DesktopIoDefaults> {
  ensureDesktop();
  try {
    return await invokeDesktop<DesktopIoDefaults>("desktop_get_document_io_defaults");
  } catch (error) {
    throw new Error(mapDesktopIoError(normalizeDesktopError(error)));
  }
}

export async function setDesktopDocumentIoDefaults(payload: DesktopIoDefaults) {
  ensureDesktop();
  try {
    return await invokeDesktop<DesktopIoDefaults>("desktop_set_document_io_defaults", { payload });
  } catch (error) {
    throw new Error(mapDesktopIoError(normalizeDesktopError(error)));
  }
}

export async function printBlob(payload: {
  blob: Blob;
  fileName: string;
  mimeType: string;
  printerId?: string;
}) {
  if (!isDesktopShell) {
    const url = URL.createObjectURL(payload.blob);
    try {
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.opacity = "0";
      frame.src = url;
      document.body.appendChild(frame);
      await new Promise<void>((resolve) => {
        frame.onload = () => resolve();
      });
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      document.body.removeChild(frame);
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }

  try {
    const bytes = Array.from(new Uint8Array(await payload.blob.arrayBuffer()));
    await invokeDesktop<void>("desktop_print_document", {
      payload: {
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        bytes,
        printerId: payload.printerId
      }
    });
  } catch (error) {
    throw new Error(mapDesktopIoError(normalizeDesktopError(error)));
  }
}

export async function scanDocument(profile?: DesktopScanProfile & { scannerId?: string }): Promise<DesktopScanJobResult> {
  ensureDesktop();
  try {
    return await invokeDesktop<DesktopScanJobResult>("desktop_scan_document", {
      payload: {
        scannerId: profile?.scannerId,
        format: profile?.format ?? "pdf",
        source: profile?.source ?? "file-picker",
        dpi: profile?.dpi,
        colorMode: profile?.colorMode
      }
    });
  } catch (error) {
    throw new Error(mapDesktopIoError(normalizeDesktopError(error)));
  }
}
