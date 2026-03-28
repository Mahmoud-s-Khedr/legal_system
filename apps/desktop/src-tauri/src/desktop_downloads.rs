use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const SETTINGS_FILE_NAME: &str = "desktop-download-settings.json";

const DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE: &str = "DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE";
const DESKTOP_DOWNLOAD_PATH_INVALID: &str = "DESKTOP_DOWNLOAD_PATH_INVALID";
const DESKTOP_DOWNLOAD_SAVE_FAILED: &str = "DESKTOP_DOWNLOAD_SAVE_FAILED";

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredDownloadSettings {
    download_directory: Option<String>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum DesktopDownloadSettingsResult {
    Success(DesktopDownloadSettingsSuccess),
    Error(DesktopDownloadSettingsError),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDownloadSettingsSuccess {
    ok: bool,
    effective_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    configured_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    changed: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDownloadSettingsError {
    ok: bool,
    code: &'static str,
}

impl DesktopDownloadSettingsResult {
    fn success(
        effective_path: String,
        configured_path: Option<String>,
        changed: Option<bool>,
    ) -> Self {
        Self::Success(DesktopDownloadSettingsSuccess {
            ok: true,
            effective_path,
            configured_path,
            changed,
        })
    }

    fn error(code: &'static str) -> Self {
        Self::Error(DesktopDownloadSettingsError { ok: false, code })
    }
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum DesktopSaveDownloadResult {
    Success(DesktopSaveDownloadSuccess),
    Error(DesktopSaveDownloadError),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSaveDownloadSuccess {
    ok: bool,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSaveDownloadError {
    ok: bool,
    code: &'static str,
}

impl DesktopSaveDownloadResult {
    fn success(path: String) -> Self {
        Self::Success(DesktopSaveDownloadSuccess { ok: true, path })
    }

    fn error(code: &'static str) -> Self {
        Self::Error(DesktopSaveDownloadError { ok: false, code })
    }
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, &'static str> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE)?;
    fs::create_dir_all(&dir).map_err(|_| DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE)?;
    Ok(dir)
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, &'static str> {
    Ok(app_data_dir(app)?.join(SETTINGS_FILE_NAME))
}

fn read_stored_settings_file(path: &Path) -> Result<StoredDownloadSettings, &'static str> {
    if !path.exists() {
        return Ok(StoredDownloadSettings::default());
    }

    let raw = fs::read_to_string(path).map_err(|_| DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE)?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn write_stored_settings_file(
    path: &Path,
    settings: &StoredDownloadSettings,
) -> Result<(), &'static str> {
    let encoded =
        serde_json::to_vec_pretty(settings).map_err(|_| DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE)?;
    fs::write(path, encoded).map_err(|_| DESKTOP_DOWNLOAD_SETTINGS_UNAVAILABLE)
}

fn read_stored_settings(app: &AppHandle) -> Result<StoredDownloadSettings, &'static str> {
    let path = settings_file_path(app)?;
    read_stored_settings_file(&path)
}

fn write_stored_settings(
    app: &AppHandle,
    settings: &StoredDownloadSettings,
) -> Result<(), &'static str> {
    let path = settings_file_path(app)?;
    write_stored_settings_file(&path, settings)
}

fn default_download_dir(app: &AppHandle) -> Result<PathBuf, &'static str> {
    if let Ok(downloads) = app.path().download_dir() {
        return Ok(downloads);
    }

    Ok(app_data_dir(app)?.join("Downloads"))
}

fn configured_download_dir(settings: &StoredDownloadSettings) -> Option<PathBuf> {
    let configured = settings.download_directory.as_ref()?.trim();
    if configured.is_empty() {
        return None;
    }
    Some(PathBuf::from(configured))
}

fn effective_download_dir(configured: Option<PathBuf>, fallback: PathBuf) -> PathBuf {
    configured.unwrap_or(fallback)
}

fn resolve_download_paths(app: &AppHandle) -> Result<(PathBuf, Option<PathBuf>), &'static str> {
    let settings = read_stored_settings(app)?;
    let configured = configured_download_dir(&settings);
    let effective = effective_download_dir(configured.clone(), default_download_dir(app)?);
    Ok((effective, configured))
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn sanitize_filename(filename: &str) -> String {
    let candidate = Path::new(filename)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("download")
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
        "download.bin".to_string()
    } else {
        normalized.to_string()
    }
}

fn with_deduped_filename(dir: &Path, filename: &str) -> PathBuf {
    let safe = sanitize_filename(filename);
    let candidate = dir.join(&safe);
    if !candidate.exists() {
        return candidate;
    }

    let parsed = Path::new(&safe);
    let stem = parsed
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    let ext = parsed.extension().and_then(|value| value.to_str());

    for idx in 1..10_000usize {
        let next_name = match ext {
            Some(ext) if !ext.is_empty() => format!("{stem} ({idx}).{ext}"),
            _ => format!("{stem} ({idx})"),
        };
        let next_path = dir.join(next_name);
        if !next_path.exists() {
            return next_path;
        }
    }

    candidate
}

pub fn save_download_bytes(
    app: &AppHandle,
    filename: &str,
    bytes: &[u8],
) -> Result<PathBuf, &'static str> {
    let (effective_dir, _) = resolve_download_paths(app)?;
    fs::create_dir_all(&effective_dir).map_err(|_| DESKTOP_DOWNLOAD_SAVE_FAILED)?;

    let target = with_deduped_filename(&effective_dir, filename);
    fs::write(&target, bytes).map_err(|_| DESKTOP_DOWNLOAD_SAVE_FAILED)?;
    Ok(target)
}

#[tauri::command]
pub async fn desktop_get_download_settings(app: AppHandle) -> DesktopDownloadSettingsResult {
    match resolve_download_paths(&app) {
        Ok((effective, configured)) => DesktopDownloadSettingsResult::success(
            path_to_string(&effective),
            configured.as_deref().map(path_to_string),
            None,
        ),
        Err(code) => DesktopDownloadSettingsResult::error(code),
    }
}

#[tauri::command]
pub async fn desktop_choose_download_directory(app: AppHandle) -> DesktopDownloadSettingsResult {
    let maybe_path = app
        .dialog()
        .file()
        .set_title("Choose Download Folder")
        .blocking_pick_folder();

    let Some(file_path) = maybe_path else {
        return desktop_get_download_settings(app).await;
    };

    let picked_path = match file_path.into_path() {
        Ok(path) => path,
        Err(_) => return DesktopDownloadSettingsResult::error(DESKTOP_DOWNLOAD_PATH_INVALID),
    };

    let mut settings = match read_stored_settings(&app) {
        Ok(settings) => settings,
        Err(code) => return DesktopDownloadSettingsResult::error(code),
    };

    settings.download_directory = Some(path_to_string(&picked_path));

    if let Err(code) = write_stored_settings(&app, &settings) {
        return DesktopDownloadSettingsResult::error(code);
    }

    match resolve_download_paths(&app) {
        Ok((effective, configured)) => DesktopDownloadSettingsResult::success(
            path_to_string(&effective),
            configured.as_deref().map(path_to_string),
            Some(true),
        ),
        Err(code) => DesktopDownloadSettingsResult::error(code),
    }
}

#[tauri::command]
pub async fn desktop_reset_download_directory(app: AppHandle) -> DesktopDownloadSettingsResult {
    let mut settings = match read_stored_settings(&app) {
        Ok(settings) => settings,
        Err(code) => return DesktopDownloadSettingsResult::error(code),
    };

    settings.download_directory = None;

    if let Err(code) = write_stored_settings(&app, &settings) {
        return DesktopDownloadSettingsResult::error(code);
    }

    match resolve_download_paths(&app) {
        Ok((effective, configured)) => DesktopDownloadSettingsResult::success(
            path_to_string(&effective),
            configured.as_deref().map(path_to_string),
            Some(true),
        ),
        Err(code) => DesktopDownloadSettingsResult::error(code),
    }
}

#[tauri::command]
pub async fn desktop_save_download_file(
    app: AppHandle,
    filename: String,
    bytes: Vec<u8>,
) -> DesktopSaveDownloadResult {
    match save_download_bytes(&app, &filename, &bytes) {
        Ok(path) => DesktopSaveDownloadResult::success(path_to_string(&path)),
        Err(code) => DesktopSaveDownloadResult::error(code),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        effective_download_dir, read_stored_settings_file, sanitize_filename,
        with_deduped_filename, write_stored_settings_file, StoredDownloadSettings,
    };
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn sanitize_filename_removes_path_and_invalid_characters() {
        let value = sanitize_filename("../weird:name?.pdf");
        assert_eq!(value, "weird_name_.pdf");
    }

    #[test]
    fn dedupe_filename_appends_numeric_suffix() {
        let tmp_root = std::env::temp_dir().join(format!(
            "elms-desktop-downloads-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("time should move forward")
                .as_nanos()
        ));
        fs::create_dir_all(&tmp_root).expect("temp dir should be created");

        let original = tmp_root.join("report.pdf");
        fs::write(&original, b"existing").expect("fixture file should be written");

        let deduped = with_deduped_filename(&tmp_root, "report.pdf");
        assert_eq!(
            deduped
                .file_name()
                .and_then(|value| value.to_str())
                .expect("deduped filename should be utf-8"),
            "report (1).pdf"
        );

        fs::remove_dir_all(&tmp_root).expect("temp dir should be removed");
    }

    #[test]
    fn settings_persistence_round_trip() {
        let tmp_root = std::env::temp_dir().join(format!(
            "elms-desktop-download-settings-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("time should move forward")
                .as_nanos()
        ));
        fs::create_dir_all(&tmp_root).expect("temp dir should be created");
        let settings_path = tmp_root.join("desktop-download-settings.json");

        let settings = StoredDownloadSettings {
            download_directory: Some("/tmp/elms-downloads".to_string()),
        };
        write_stored_settings_file(&settings_path, &settings).expect("settings should be written");

        let loaded = read_stored_settings_file(&settings_path).expect("settings should be read");
        assert_eq!(
            loaded.download_directory.as_deref(),
            Some("/tmp/elms-downloads")
        );

        fs::remove_dir_all(&tmp_root).expect("temp dir should be removed");
    }

    #[test]
    fn effective_directory_prefers_configured_path() {
        let fallback = PathBuf::from("/home/user/Downloads");
        let configured = Some(PathBuf::from("/mnt/shared/elms-downloads"));
        let resolved = effective_download_dir(configured, fallback.clone());
        assert_eq!(resolved, PathBuf::from("/mnt/shared/elms-downloads"));

        let resolved_default = effective_download_dir(None, fallback.clone());
        assert_eq!(resolved_default, fallback);
    }
}
