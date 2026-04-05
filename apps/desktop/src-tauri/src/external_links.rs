use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn desktop_open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    let next_url = url.trim();
    if next_url.is_empty() {
        return Err("DESKTOP_OPEN_EXTERNAL_INVALID_URL".to_string());
    }

    app.shell()
        .open(next_url, None)
        .map_err(|_| "DESKTOP_OPEN_EXTERNAL_FAILED".to_string())
}
