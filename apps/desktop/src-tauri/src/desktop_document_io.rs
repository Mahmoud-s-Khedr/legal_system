use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const SETTINGS_FILE_NAME: &str = "desktop-document-io-settings.json";
const ERR_UNAVAILABLE: &str = "DESKTOP_DOCUMENT_IO_UNAVAILABLE";
const ERR_INVALID_INPUT: &str = "DESKTOP_DOCUMENT_IO_INVALID_INPUT";
const ERR_SCAN_CANCELLED: &str = "DESKTOP_SCAN_CANCELLED";
const ERR_SCAN_FAILED: &str = "DESKTOP_SCAN_FAILED";
const ERR_PRINT_FAILED: &str = "DESKTOP_PRINT_FAILED";

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredIoSettings {
    default_printer_id: Option<String>,
    default_scanner_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPrintDocumentInput {
    pub file_name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
    pub printer_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopScanDocumentInput {
    pub scanner_id: Option<String>,
    pub format: Option<String>,
    pub source: Option<String>,
    pub dpi: Option<u32>,
    pub color_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopIoDefaultsInput {
    pub default_printer_id: Option<String>,
    pub default_scanner_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPrinter {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopScanner {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopIoDefaults {
    pub default_printer_id: Option<String>,
    pub default_scanner_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCapabilityDetail {
    pub available: bool,
    pub provider: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDocumentIoCapability {
    pub is_desktop: bool,
    pub print: DesktopCapabilityDetail,
    pub scan: DesktopCapabilityDetail,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopScanDocumentResult {
    pub scanner_id: String,
    pub scanner_name: String,
    pub file_name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
    pub source: String,
    pub actual_format: String,
    pub page_count: u32,
    pub provider: String,
}

#[derive(Debug)]
struct PrintCommandResult {
    code: &'static str,
    message: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| ERR_UNAVAILABLE.to_string())?;
    fs::create_dir_all(&dir).map_err(|_| ERR_UNAVAILABLE.to_string())?;
    Ok(dir)
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(SETTINGS_FILE_NAME))
}

fn read_settings(app: &AppHandle) -> Result<StoredIoSettings, String> {
    let path = settings_file_path(app)?;
    if !path.exists() {
        return Ok(StoredIoSettings::default());
    }
    let raw = fs::read_to_string(path).map_err(|_| ERR_UNAVAILABLE.to_string())?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn write_settings(app: &AppHandle, settings: &StoredIoSettings) -> Result<(), String> {
    let path = settings_file_path(app)?;
    let encoded = serde_json::to_vec_pretty(settings).map_err(|_| ERR_UNAVAILABLE.to_string())?;
    fs::write(path, encoded).map_err(|_| ERR_UNAVAILABLE.to_string())
}

fn sanitize_filename(filename: &str) -> String {
    let candidate = Path::new(filename)
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("document")
        .trim();

    let cleaned: String = candidate
        .chars()
        .map(|ch| {
            if matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || ch.is_control()
            {
                '_'
            } else {
                ch
            }
        })
        .collect();

    let normalized = cleaned.trim_matches('.').trim();
    if normalized.is_empty() {
        "document.bin".to_string()
    } else {
        normalized.to_string()
    }
}

fn normalize_format(format: Option<&str>) -> &'static str {
    match format
        .map(|v| v.trim().to_ascii_lowercase())
        .unwrap_or_else(|| "pdf".to_string())
        .as_str()
    {
        "pdf" => "pdf",
        "tiff" => "tiff",
        "png" => "png",
        _ => "pdf",
    }
}

fn normalize_mime_type(format: &str) -> &'static str {
    match format {
        "png" => "image/png",
        "tiff" => "image/tiff",
        _ => "application/pdf",
    }
}

fn normalize_scan_source(source: Option<&str>) -> &'static str {
    match source
        .map(|v| v.trim().to_ascii_lowercase())
        .unwrap_or_else(|| "file-picker".to_string())
        .as_str()
    {
        "device" => "device",
        _ => "file-picker",
    }
}

fn resolve_default_printer_from_lpstat(stdout: &str) -> Option<String> {
    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("system default destination:") {
            continue;
        }
        let value = trimmed
            .trim_start_matches("system default destination:")
            .trim();
        if !value.is_empty() {
            return Some(value.to_string());
        }
    }
    None
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn list_printers_unix() -> Result<Vec<DesktopPrinter>, String> {
    let output = Command::new("lpstat")
        .args(["-p", "-d"])
        .output()
        .map_err(|_| {
            "PRINT_COMMAND_MISSING:lpstat is not installed or not available in PATH".to_string()
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let reason = if stderr.is_empty() {
            "lpstat failed".to_string()
        } else {
            format!("lpstat failed: {stderr}")
        };
        return Err(format!("DESKTOP_PRINT_COMMAND_FAILED:{reason}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let default_printer = resolve_default_printer_from_lpstat(&stdout);

    let mut printers = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("printer ") {
            continue;
        }
        let mut parts = trimmed.split_whitespace();
        let _ = parts.next();
        if let Some(name) = parts.next() {
            printers.push(DesktopPrinter {
                id: name.to_string(),
                name: name.to_string(),
                is_default: default_printer.as_deref() == Some(name),
            });
        }
    }

    Ok(printers)
}

#[cfg(target_os = "windows")]
fn list_printers_windows() -> Result<Vec<DesktopPrinter>, String> {
    let script = "Get-Printer | Select-Object Name,Default | ConvertTo-Json -Compress";
    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|_| "PRINT_COMMAND_MISSING:powershell is not available".to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!("DESKTOP_PRINT_COMMAND_FAILED:{stderr}"));
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        return Ok(Vec::new());
    }

    #[derive(Deserialize)]
    struct WinPrinter {
        #[serde(rename = "Name")]
        name: String,
        #[serde(rename = "Default")]
        default: Option<bool>,
    }

    let parse_many = serde_json::from_str::<Vec<WinPrinter>>(&raw);
    let rows = match parse_many {
        Ok(v) => v,
        Err(_) => serde_json::from_str::<WinPrinter>(&raw)
            .map(|v| vec![v])
            .unwrap_or_default(),
    };

    Ok(rows
        .into_iter()
        .map(|it| DesktopPrinter {
            id: it.name.clone(),
            name: it.name,
            is_default: it.default.unwrap_or(false),
        })
        .collect())
}

fn list_printers() -> Result<Vec<DesktopPrinter>, String> {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        return list_printers_unix();
    }

    #[cfg(target_os = "windows")]
    {
        return list_printers_windows();
    }

    #[allow(unreachable_code)]
    Ok(Vec::new())
}

fn list_scanners() -> (Vec<DesktopScanner>, String, Option<String>) {
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("scanimage").arg("-L").output();
        match output {
            Ok(out) if out.status.success() => {
                let text = String::from_utf8_lossy(&out.stdout);
                let mut scanners = Vec::new();
                for line in text.lines() {
                    let trimmed = line.trim();
                    if !trimmed.starts_with("device `") {
                        continue;
                    }
                    let Some(rest) = trimmed.strip_prefix("device `") else {
                        continue;
                    };
                    let Some((id, after_id)) = rest.split_once("'") else {
                        continue;
                    };
                    // Ignore webcam/virtual capture devices that SANE may expose via V4L.
                    // These are not real document scanners for our workflow.
                    if id.starts_with("v4l:") {
                        continue;
                    }
                    let label = after_id.trim().trim_start_matches("is").trim();
                    let name = if label.is_empty() { id } else { label };
                    scanners.push(DesktopScanner {
                        id: id.to_string(),
                        name: name.to_string(),
                        is_default: scanners.is_empty(),
                    });
                }
                return (scanners, "sane".to_string(), None);
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                return (
                    Vec::new(),
                    "sane".to_string(),
                    Some(if stderr.is_empty() {
                        "scanimage failed".to_string()
                    } else {
                        format!("scanimage failed: {stderr}")
                    }),
                );
            }
            Err(_) => {
                return (
                    Vec::new(),
                    "sane".to_string(),
                    Some("scanimage command not found; falling back to file picker".to_string()),
                );
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        return (
            Vec::new(),
            "ica".to_string(),
            Some("Direct scanner enumeration is not configured; using file picker".to_string()),
        );
    }

    #[cfg(target_os = "windows")]
    {
        return (
            Vec::new(),
            "wia".to_string(),
            Some("Direct scanner enumeration is not configured; using file picker".to_string()),
        );
    }

    #[allow(unreachable_code)]
    {
        (
            Vec::new(),
            "file-picker".to_string(),
            Some("Scanner integration unavailable; using file picker".to_string()),
        )
    }
}

fn chosen_scanner(scanners: &[DesktopScanner], scanner_id: Option<&str>) -> (String, String) {
    if let Some(id) = scanner_id {
        if let Some(item) = scanners.iter().find(|it| it.id == id) {
            return (item.id.clone(), item.name.clone());
        }
    }
    if let Some(item) = scanners.iter().find(|it| it.is_default) {
        return (item.id.clone(), item.name.clone());
    }
    if let Some(item) = scanners.first() {
        return (item.id.clone(), item.name.clone());
    }
    ("file-picker-default".to_string(), "File picker".to_string())
}

fn print_file(path: &Path, selected_printer: Option<&str>) -> Result<(), PrintCommandResult> {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        let mut command = Command::new("lp");
        if let Some(printer) = selected_printer {
            command.arg("-d").arg(printer);
        }
        command.arg(path.as_os_str());

        let output = command.output().map_err(|_| PrintCommandResult {
            code: "PRINT_COMMAND_MISSING",
            message: "lp command not found in PATH".to_string(),
        })?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let combined = if !stderr.is_empty() { stderr } else { stdout };
        let lower = combined.to_ascii_lowercase();

        let code = if lower.contains("no default destination") {
            "NO_DEFAULT_PRINTER"
        } else if lower.contains("unknown destination") || lower.contains("not found") {
            "PRINTER_NOT_FOUND"
        } else {
            "PRINT_COMMAND_FAILED"
        };

        return Err(PrintCommandResult {
            code,
            message: if combined.is_empty() {
                "lp failed".to_string()
            } else {
                combined
            },
        });
    }

    #[cfg(target_os = "windows")]
    {
        let quoted_path = path.display().to_string().replace('"', "\\\"");
        let script = if let Some(printer) = selected_printer {
            let _ = printer;
            format!(
                "$p=Start-Process -FilePath '{}' -Verb Print -PassThru; Start-Sleep -Seconds 2; if ($p) {{ $null = $p | Out-Null }}",
                quoted_path
            )
        } else {
            format!("Start-Process -FilePath '{}' -Verb Print", quoted_path)
        };

        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|_| PrintCommandResult {
                code: "PRINT_COMMAND_MISSING",
                message: "powershell not available".to_string(),
            })?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(PrintCommandResult {
            code: "PRINT_COMMAND_FAILED",
            message: if stderr.is_empty() {
                "Print command failed".to_string()
            } else {
                stderr
            },
        });
    }

    #[allow(unreachable_code)]
    Err(PrintCommandResult {
        code: "PRINT_COMMAND_FAILED",
        message: "Unsupported platform".to_string(),
    })
}

#[tauri::command]
pub async fn desktop_list_printers(app: AppHandle) -> Result<Vec<DesktopPrinter>, String> {
    let settings = read_settings(&app)?;
    let preferred_default = settings.default_printer_id;

    let mut printers = list_printers().unwrap_or_default();

    if let Some(preferred) = preferred_default {
        let mut found = false;
        for printer in &mut printers {
            if printer.id == preferred {
                printer.is_default = true;
                found = true;
            } else {
                printer.is_default = false;
            }
        }
        if !found {
            for printer in &mut printers {
                printer.is_default = false;
            }
        }
    }

    Ok(printers)
}

#[tauri::command]
pub async fn desktop_list_scanners(app: AppHandle) -> Result<Vec<DesktopScanner>, String> {
    let settings = read_settings(&app)?;
    let default_scanner = settings.default_scanner_id;
    let (mut scanners, _, _) = list_scanners();

    if let Some(default_id) = default_scanner {
        let mut found = false;
        for scanner in &mut scanners {
            if scanner.id == default_id {
                scanner.is_default = true;
                found = true;
            } else {
                scanner.is_default = false;
            }
        }
        if !found {
            for scanner in &mut scanners {
                scanner.is_default = false;
            }
        }
    }

    Ok(scanners)
}

#[tauri::command]
pub async fn desktop_get_document_io_defaults(app: AppHandle) -> Result<DesktopIoDefaults, String> {
    let settings = read_settings(&app)?;
    Ok(DesktopIoDefaults {
        default_printer_id: settings.default_printer_id,
        default_scanner_id: settings.default_scanner_id,
    })
}

#[tauri::command]
pub async fn desktop_set_document_io_defaults(
    app: AppHandle,
    payload: DesktopIoDefaultsInput,
) -> Result<DesktopIoDefaults, String> {
    let normalized_printer = payload
        .default_printer_id
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let normalized_scanner = payload
        .default_scanner_id
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    write_settings(
        &app,
        &StoredIoSettings {
            default_printer_id: normalized_printer.clone(),
            default_scanner_id: normalized_scanner.clone(),
        },
    )?;

    Ok(DesktopIoDefaults {
        default_printer_id: normalized_printer,
        default_scanner_id: normalized_scanner,
    })
}

#[tauri::command]
pub async fn desktop_get_document_io_capability(
    _app: AppHandle,
) -> Result<DesktopDocumentIoCapability, String> {
    let print_probe = list_printers();
    let (print_available, print_reason) = match print_probe {
        Ok(printers) => {
            if printers.is_empty() {
                (
                    false,
                    Some("No printer detected on this machine.".to_string()),
                )
            } else {
                (true, None)
            }
        }
        Err(error) => (false, Some(error)),
    };

    let (scanners, scan_provider, scan_reason) = list_scanners();
    let scan_available = !scanners.is_empty();
    let scan_reason = if scan_available {
        None
    } else {
        Some(scan_reason.unwrap_or_else(|| "No scanner detected on this machine.".to_string()))
    };

    Ok(DesktopDocumentIoCapability {
        is_desktop: true,
        print: DesktopCapabilityDetail {
            available: print_available,
            provider: if cfg!(target_os = "windows") {
                "windows-print".to_string()
            } else {
                "cups".to_string()
            },
            reason: print_reason,
        },
        scan: DesktopCapabilityDetail {
            available: scan_available,
            provider: scan_provider,
            reason: scan_reason,
        },
    })
}

#[tauri::command]
pub async fn desktop_print_document(
    app: AppHandle,
    payload: DesktopPrintDocumentInput,
) -> Result<(), String> {
    if payload.bytes.is_empty()
        || payload.file_name.trim().is_empty()
        || payload.mime_type.trim().is_empty()
    {
        return Err(ERR_INVALID_INPUT.to_string());
    }

    let filename = sanitize_filename(&payload.file_name);
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|_| ERR_PRINT_FAILED.to_string())?;
    let temp_path = temp_dir.join(filename);

    fs::write(&temp_path, payload.bytes).map_err(|_| ERR_PRINT_FAILED.to_string())?;
    let result = print_file(&temp_path, payload.printer_id.as_deref());
    let _ = fs::remove_file(&temp_path);

    match result {
        Ok(()) => Ok(()),
        Err(err) => Err(format!("{}:{}", err.code, err.message)),
    }
}

#[tauri::command]
pub async fn desktop_scan_document(
    app: AppHandle,
    payload: DesktopScanDocumentInput,
) -> Result<DesktopScanDocumentResult, String> {
    let format = normalize_format(payload.format.as_deref());
    let source = normalize_scan_source(payload.source.as_deref());
    let _ = payload.dpi;
    let _ = payload.color_mode.as_deref();

    let (scanners, provider, _provider_reason) = list_scanners();
    let (scanner_id, scanner_name) = chosen_scanner(&scanners, payload.scanner_id.as_deref());

    // v1-v2 hybrid: device source currently falls back to file picker when provider capture isn't wired.
    let actual_source = if source == "device" && scanners.is_empty() {
        "file-picker"
    } else {
        source
    };

    let maybe_file = app
        .dialog()
        .file()
        .set_title("Select Scanned File")
        .blocking_pick_file();

    let file_path = maybe_file.ok_or_else(|| ERR_SCAN_CANCELLED.to_string())?;
    let path = file_path
        .into_path()
        .map_err(|_| ERR_SCAN_FAILED.to_string())?;
    let bytes = fs::read(&path).map_err(|_| ERR_SCAN_FAILED.to_string())?;

    let ext = if format == "pdf" {
        "pdf"
    } else if format == "tiff" {
        "tiff"
    } else {
        "png"
    };

    let file_name = format!(
        "scan-{}.{}",
        chrono::Utc::now().format("%Y%m%d-%H%M%S"),
        ext
    );

    Ok(DesktopScanDocumentResult {
        scanner_id,
        scanner_name,
        file_name,
        mime_type: normalize_mime_type(format).to_string(),
        bytes,
        source: actual_source.to_string(),
        actual_format: format.to_string(),
        page_count: 1,
        provider,
    })
}

#[cfg(test)]
mod tests {
    use super::{normalize_scan_source, resolve_default_printer_from_lpstat};

    #[test]
    fn parses_default_printer_from_lpstat_output() {
        let out = "printer hp is idle. enabled since Thu\nsystem default destination: hp\n";
        assert_eq!(
            resolve_default_printer_from_lpstat(out).as_deref(),
            Some("hp")
        );
    }

    #[test]
    fn normalizes_scan_source() {
        assert_eq!(normalize_scan_source(Some("device")), "device");
        assert_eq!(normalize_scan_source(Some("unknown")), "file-picker");
        assert_eq!(normalize_scan_source(None), "file-picker");
    }
}
