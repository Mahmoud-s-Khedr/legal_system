use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

const BACKEND_CONNECTION_FILE: &str = "backend-connection.json";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredBackendConnection {
    #[serde(default)]
    base_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendConnectionResponse {
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendConnectionSetResult {
    pub ok: bool,
    pub code: Option<String>,
}

fn normalize_base_url(input: &str) -> Result<String, String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("BACKEND_URL_EMPTY".to_string());
    }

    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("BACKEND_URL_INVALID_SCHEME".to_string());
    }

    // Basic host presence check: require host segment after scheme.
    let without_scheme = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or_default();
    if without_scheme.is_empty() || without_scheme.starts_with('/') {
        return Err("BACKEND_URL_INVALID_HOST".to_string());
    }

    Ok(trimmed.to_string())
}

fn connection_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = crate::sidecar::resolve_desktop_app_data_dir(app)?;
    Ok(app_data_dir.join(BACKEND_CONNECTION_FILE))
}

fn load_connection(app: &AppHandle) -> Result<StoredBackendConnection, String> {
    let file_path = connection_file_path(app)?;
    if !file_path.exists() {
        return Ok(StoredBackendConnection { base_url: None });
    }

    let raw = fs::read_to_string(&file_path)
        .map_err(|error| format!("Unable to read backend connection settings: {error}"))?;
    let parsed = serde_json::from_str::<StoredBackendConnection>(&raw)
        .map_err(|error| format!("Unable to parse backend connection settings: {error}"))?;
    Ok(parsed)
}

fn save_connection(app: &AppHandle, connection: &StoredBackendConnection) -> Result<(), String> {
    let file_path = connection_file_path(app)?;
    let payload = serde_json::to_string_pretty(connection)
        .map_err(|error| format!("Unable to serialize backend connection settings: {error}"))?;
    fs::write(file_path, payload)
        .map_err(|error| format!("Unable to write backend connection settings: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn desktop_get_backend_connection(app: AppHandle) -> Result<BackendConnectionResponse, String> {
    let stored = load_connection(&app)?;
    Ok(BackendConnectionResponse {
        base_url: stored
            .base_url
            .as_deref()
            .and_then(|value| normalize_base_url(value).ok()),
    })
}

#[tauri::command]
pub fn desktop_set_backend_connection(
    app: AppHandle,
    base_url: Option<String>,
) -> Result<BackendConnectionSetResult, String> {
    let normalized = match base_url {
        Some(value) if value.trim().is_empty() => None,
        Some(value) => match normalize_base_url(&value) {
            Ok(valid) => Some(valid),
            Err(code) => {
                return Ok(BackendConnectionSetResult {
                    ok: false,
                    code: Some(code),
                });
            }
        },
        None => None,
    };

    save_connection(
        &app,
        &StoredBackendConnection {
            base_url: normalized,
        },
    )?;

    Ok(BackendConnectionSetResult {
        ok: true,
        code: None,
    })
}
