use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn desktop_open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    let next_url = url.trim();
    if next_url.is_empty() {
        return Err("DESKTOP_OPEN_EXTERNAL_INVALID_URL".to_string());
    }

    app.opener()
        .open_url(next_url, None::<&str>)
        .map_err(|_| "DESKTOP_OPEN_EXTERNAL_FAILED".to_string())
}
