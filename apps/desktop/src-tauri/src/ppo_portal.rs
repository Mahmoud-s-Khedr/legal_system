use serde::Serialize;
use tauri::{AppHandle, Manager, Url, WebviewUrl};

const PPO_PORTAL_URL: &str = "https://ppo.gov.eg/ppo/r/ppoportal/ppoportal/home";
const PPO_WINDOW_LABEL: &str = "ppo-portal";
const PPO_WINDOW_TITLE: &str = "PPO Portal";
#[cfg(target_os = "macos")]
const PPO_TLS_BYPASS_UNSUPPORTED_MACOS: &str = "PPO_TLS_BYPASS_UNSUPPORTED_MACOS";
const PPO_DESKTOP_LAUNCH_FAILED: &str = "PPO_DESKTOP_LAUNCH_FAILED";

#[cfg(windows)]
const PPO_WINDOWS_ADDITIONAL_BROWSER_ARGS: &str =
    "--ignore-certificate-errors --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

#[derive(Serialize)]
#[serde(untagged)]
pub enum OpenPpoPortalWindowResult {
    Success(OpenPpoPortalWindowSuccess),
    Error(OpenPpoPortalWindowError),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPpoPortalWindowSuccess {
    ok: bool,
    reused: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPpoPortalWindowError {
    ok: bool,
    code: &'static str,
}

impl OpenPpoPortalWindowResult {
    fn success(reused: bool) -> Self {
        Self::Success(OpenPpoPortalWindowSuccess { ok: true, reused })
    }

    fn error(code: &'static str) -> Self {
        Self::Error(OpenPpoPortalWindowError { ok: false, code })
    }
}

fn focus_window(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

fn parse_url(url: &str) -> Option<Url> {
    Url::parse(url).ok()
}

#[cfg(target_os = "linux")]
fn attach_linux_tls_bypass(window: &tauri::WebviewWindow) -> Result<(), tauri::Error> {
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex};
    use webkit2gtk::{WebContextExt, WebViewExt};

    let retried_hosts = Arc::new(Mutex::new(HashSet::<String>::new()));
    window.with_webview(move |platform_webview| {
        let webview = platform_webview.inner();
        let retried_hosts = Arc::clone(&retried_hosts);

        webview.connect_load_failed_with_tls_errors(
            move |view: &webkit2gtk::WebView, failing_uri, certificate, _errors| {
            let host = Url::parse(failing_uri)
                .ok()
                .and_then(|uri| uri.host_str().map(str::to_owned));

            let Some(host) = host else {
                return false;
            };

            let Some(context) = view.context() else {
                return false;
            };
            context.allow_tls_certificate_for_host(certificate, &host);

            let should_retry = match retried_hosts.lock() {
                Ok(mut hosts) => hosts.insert(host),
                Err(_) => true,
            };

            if should_retry {
                view.load_uri(failing_uri);
            }

            true
        },
        );
    })
}

#[tauri::command]
pub async fn open_ppo_portal_window(app: AppHandle) -> OpenPpoPortalWindowResult {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        return OpenPpoPortalWindowResult::error(PPO_TLS_BYPASS_UNSUPPORTED_MACOS);
    }

    if let Some(window) = app.get_webview_window(PPO_WINDOW_LABEL) {
        focus_window(&window);
        return OpenPpoPortalWindowResult::success(true);
    }

    let Some(blank_url) = parse_url("about:blank") else {
        return OpenPpoPortalWindowResult::error(PPO_DESKTOP_LAUNCH_FAILED);
    };
    let Some(portal_url) = parse_url(PPO_PORTAL_URL) else {
        return OpenPpoPortalWindowResult::error(PPO_DESKTOP_LAUNCH_FAILED);
    };

    #[allow(unused_mut)]
    let mut builder = tauri::WebviewWindowBuilder::new(&app, PPO_WINDOW_LABEL, WebviewUrl::External(blank_url))
        .title(PPO_WINDOW_TITLE)
        .inner_size(1280.0, 900.0)
        .resizable(true)
        .focused(true);

    #[cfg(windows)]
    {
        builder = builder.additional_browser_args(PPO_WINDOWS_ADDITIONAL_BROWSER_ARGS);
        if let Ok(data_dir) = app.path().app_data_dir() {
            builder = builder.data_directory(data_dir.join("ppo-webview"));
        }
    }

    let window = match builder.build() {
        Ok(window) => window,
        Err(_) => return OpenPpoPortalWindowResult::error(PPO_DESKTOP_LAUNCH_FAILED),
    };

    #[cfg(target_os = "linux")]
    if attach_linux_tls_bypass(&window).is_err() {
        let _ = window.close();
        return OpenPpoPortalWindowResult::error(PPO_DESKTOP_LAUNCH_FAILED);
    }

    if window.navigate(portal_url).is_err() {
        let _ = window.close();
        return OpenPpoPortalWindowResult::error(PPO_DESKTOP_LAUNCH_FAILED);
    }

    focus_window(&window);

    OpenPpoPortalWindowResult::success(false)
}

const PPO_WINDOW_NOT_OPEN: &str = "PPO_WINDOW_NOT_OPEN";
const PPO_NAVIGATION_FAILED: &str = "PPO_NAVIGATION_FAILED";
const PPO_URL_UNAVAILABLE: &str = "PPO_URL_UNAVAILABLE";

#[derive(Serialize)]
#[serde(untagged)]
pub enum PpoPortalNavigateResult {
    Success(PpoPortalNavigateSuccess),
    Error(PpoPortalNavigateError),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PpoPortalNavigateSuccess {
    ok: bool,
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PpoPortalNavigateError {
    ok: bool,
    code: &'static str,
}

impl PpoPortalNavigateResult {
    fn success(action: impl Into<String>, url: Option<String>) -> Self {
        Self::Success(PpoPortalNavigateSuccess {
            ok: true,
            action: action.into(),
            url,
        })
    }

    fn error(code: &'static str) -> Self {
        Self::Error(PpoPortalNavigateError { ok: false, code })
    }
}

#[tauri::command]
pub async fn ppo_portal_navigate(app: AppHandle, action: String) -> PpoPortalNavigateResult {
    let Some(window) = app.get_webview_window(PPO_WINDOW_LABEL) else {
        return PpoPortalNavigateResult::error(PPO_WINDOW_NOT_OPEN);
    };

    match action.as_str() {
        "back" => {
            if window.eval("history.back()").is_err() {
                return PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED);
            }
            PpoPortalNavigateResult::success("back", None)
        }
        "forward" => {
            if window.eval("history.forward()").is_err() {
                return PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED);
            }
            PpoPortalNavigateResult::success("forward", None)
        }
        "reload" => {
            if window.reload().is_err() {
                return PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED);
            }
            PpoPortalNavigateResult::success("reload", None)
        }
        "home" => {
            let Some(portal_url) = parse_url(PPO_PORTAL_URL) else {
                return PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED);
            };
            if window.navigate(portal_url).is_err() {
                return PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED);
            }
            PpoPortalNavigateResult::success("home", None)
        }
        "open_external" => {
            let url = match window.url() {
                Ok(u) => u.to_string(),
                Err(_) => return PpoPortalNavigateResult::error(PPO_URL_UNAVAILABLE),
            };
            use tauri_plugin_shell::ShellExt;
            #[allow(deprecated)]
            if app.shell().open(&url, None).is_err() {
                return PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED);
            }
            PpoPortalNavigateResult::success("open_external", Some(url))
        }
        "get_state" => {
            let url = match window.url() {
                Ok(u) => u.to_string(),
                Err(_) => return PpoPortalNavigateResult::error(PPO_URL_UNAVAILABLE),
            };
            PpoPortalNavigateResult::success("get_state", Some(url))
        }
        _ => PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED),
    }
}
