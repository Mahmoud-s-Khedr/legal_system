mod desktop_downloads;
mod ppo_portal;
mod sidecar;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(sidecar::RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            sidecar::desktop_bootstrap_status,
            sidecar::retry_bootstrap,
            sidecar::repair_bootstrap_migrations,
            sidecar::reset_local_database,
            desktop_downloads::desktop_get_download_settings,
            desktop_downloads::desktop_choose_download_directory,
            desktop_downloads::desktop_reset_download_directory,
            desktop_downloads::desktop_save_download_file,
            ppo_portal::open_ppo_portal_window,
            ppo_portal::ppo_portal_navigate
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                sidecar::start_runtime_bootstrap(&handle);
            });

            if let Some(window) = app.get_webview_window("main") {
                window.set_title("ELMS")?;
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build ELMS desktop shell")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                sidecar::shutdown_runtime(app);
            }
        });
}
