#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend_connection;
mod desktop_backup;
mod desktop_downloads;
mod external_links;
mod ppo_portal;
mod sidecar;

use tauri::Manager;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DesktopRuntimeVariant {
    Embedded,
    Dummy,
}

fn runtime_variant_from_identifier(identifier: &str) -> DesktopRuntimeVariant {
    if identifier.ends_with(".dummy") {
        return DesktopRuntimeVariant::Dummy;
    }

    DesktopRuntimeVariant::Embedded
}

fn runtime_variant() -> DesktopRuntimeVariant {
    if let Some(value) = std::env::var("DESKTOP_RUNTIME_VARIANT")
        .ok()
        .map(|value| value.trim().to_ascii_lowercase())
    {
        return if value == "dummy" {
            DesktopRuntimeVariant::Dummy
        } else {
            DesktopRuntimeVariant::Embedded
        };
    }

    runtime_variant_from_identifier("com.elms.desktop")
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(sidecar::RuntimeState::default())
        .manage(desktop_backup::BackupState::default())
        .invoke_handler(tauri::generate_handler![
            sidecar::desktop_bootstrap_status,
            sidecar::retry_bootstrap,
            sidecar::repair_bootstrap_migrations,
            sidecar::reset_local_database,
            sidecar::repair_postgres_runtime,
            sidecar::desktop_get_runtime_backend_url,
            desktop_backup::desktop_get_backup_policy,
            desktop_backup::desktop_set_backup_policy,
            desktop_backup::desktop_choose_backup_directory,
            desktop_backup::desktop_reset_backup_directory,
            desktop_backup::desktop_list_backups,
            desktop_backup::desktop_run_backup_now,
            desktop_backup::desktop_restore_backup,
            backend_connection::desktop_get_backend_connection,
            backend_connection::desktop_set_backend_connection,
            desktop_downloads::desktop_get_download_settings,
            desktop_downloads::desktop_choose_download_directory,
            desktop_downloads::desktop_reset_download_directory,
            desktop_downloads::desktop_save_download_file,
            external_links::desktop_open_external_url,
            ppo_portal::open_ppo_portal_window,
            ppo_portal::ppo_portal_navigate
        ])
        .setup(|app| {
            let app_identifier = app.config().identifier.clone();
            let variant = match runtime_variant() {
                DesktopRuntimeVariant::Dummy => DesktopRuntimeVariant::Dummy,
                DesktopRuntimeVariant::Embedded => runtime_variant_from_identifier(&app_identifier),
            };

            if variant == DesktopRuntimeVariant::Embedded {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    sidecar::start_runtime_bootstrap(&handle);
                });
                desktop_backup::start_backup_scheduler(app.handle().clone());
            }

            if let Some(window) = app.get_webview_window("main") {
                if variant == DesktopRuntimeVariant::Dummy {
                    window.set_title("ELMS Dummy Client")?;
                } else {
                    window.set_title("ELMS")?;
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build ELMS desktop shell")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let variant = match runtime_variant() {
                    DesktopRuntimeVariant::Dummy => DesktopRuntimeVariant::Dummy,
                    DesktopRuntimeVariant::Embedded => {
                        runtime_variant_from_identifier(&app.config().identifier)
                    }
                };
                if variant == DesktopRuntimeVariant::Embedded {
                    sidecar::shutdown_runtime(app);
                }
            }
        });
}
