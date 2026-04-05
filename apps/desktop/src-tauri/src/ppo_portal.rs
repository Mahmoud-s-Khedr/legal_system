use crate::desktop_downloads;
use serde::Serialize;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{webview::PageLoadEvent, AppHandle, Emitter, Manager, Url, WebviewUrl};

const PPO_PORTAL_URL: &str = "https://ppo.gov.eg/ppo/r/ppoportal/ppoportal/home";
const PPO_WINDOW_LABEL: &str = "ppo-portal";
const PPO_WINDOW_TITLE: &str = "PPO Portal";
const PPO_TOOLBAR_SCHEME: &str = "elms-ppo";
const PPO_SCREENSHOT_EVENT: &str = "ppo://screenshot-result";

#[cfg(target_os = "macos")]
const PPO_TLS_BYPASS_UNSUPPORTED_MACOS: &str = "PPO_TLS_BYPASS_UNSUPPORTED_MACOS";
const PPO_DESKTOP_LAUNCH_FAILED: &str = "PPO_DESKTOP_LAUNCH_FAILED";

const PPO_WINDOW_NOT_OPEN: &str = "PPO_WINDOW_NOT_OPEN";
const PPO_NAVIGATION_FAILED: &str = "PPO_NAVIGATION_FAILED";
const PPO_URL_UNAVAILABLE: &str = "PPO_URL_UNAVAILABLE";
const PPO_SCREENSHOT_CAPTURE_FAILED: &str = "PPO_SCREENSHOT_CAPTURE_FAILED";
const PPO_SCREENSHOT_SAVE_FAILED: &str = "PPO_SCREENSHOT_SAVE_FAILED";

#[cfg(windows)]
const PPO_WINDOWS_ADDITIONAL_BROWSER_ARGS: &str =
    "--ignore-certificate-errors --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

const PPO_TOOLBAR_INJECTION_SCRIPT: &str = r#"
(() => {
  const ensureToastApi = () => {
    if (typeof window.__elmsPpoShowToast === 'function') {
      return;
    }

    let container = document.getElementById('__elms_ppo_toast_container');
    if (!(container instanceof HTMLDivElement)) {
      container = document.createElement('div');
      container.id = '__elms_ppo_toast_container';
      container.style.position = 'fixed';
      container.style.top = '16px';
      container.style.right = '16px';
      container.style.zIndex = '2147483647';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      container.style.pointerEvents = 'none';
      container.style.maxWidth = 'min(460px, calc(100vw - 24px))';
    }

    if (document.body && !document.getElementById('__elms_ppo_toast_container')) {
      document.body.appendChild(container);
    }

    window.__elmsPpoShowToast = (message, variant = 'info') => {
      const host = document.getElementById('__elms_ppo_toast_container');
      if (!(host instanceof HTMLDivElement)) {
        return;
      }

      const toast = document.createElement('div');
      toast.style.padding = '10px 12px';
      toast.style.borderRadius = '10px';
      toast.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.18)';
      toast.style.fontFamily = 'sans-serif';
      toast.style.fontSize = '13px';
      toast.style.lineHeight = '1.4';
      toast.style.fontWeight = '600';
      toast.style.pointerEvents = 'auto';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      toast.style.transition = 'opacity 180ms ease, transform 180ms ease';

      if (variant === 'success') {
        toast.style.background = '#065f46';
        toast.style.color = '#ecfdf5';
        toast.style.border = '1px solid #047857';
      } else if (variant === 'error') {
        toast.style.background = '#991b1b';
        toast.style.color = '#fef2f2';
        toast.style.border = '1px solid #b91c1c';
      } else {
        toast.style.background = '#0f172a';
        toast.style.color = '#f8fafc';
        toast.style.border = '1px solid #1e293b';
      }

      toast.textContent = String(message);
      host.appendChild(toast);

      window.requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });

      window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-6px)';
        window.setTimeout(() => {
          toast.remove();
        }, 220);
      }, 3600);
    };
  };

  ensureToastApi();

  if (document.getElementById('__elms_ppo_toolbar')) {
    return;
  }

  const actions = [
    { action: 'back', label: 'Back', hint: 'Alt+Left' },
    { action: 'forward', label: 'Forward', hint: 'Alt+Right' },
    { action: 'reload', label: 'Reload', hint: 'Ctrl+R' },
    { action: 'home', label: 'Home', hint: 'Alt+Home' },
    { action: 'open_external', label: 'Open Browser', hint: '' },
    { action: 'screenshot', label: 'Screenshot', hint: '' }
  ];

  const bar = document.createElement('div');
  bar.id = '__elms_ppo_toolbar';
  bar.style.position = 'fixed';
  bar.style.left = '10px';
  bar.style.right = '10px';
  bar.style.bottom = '10px';
  bar.style.zIndex = '2147483647';
  bar.style.display = 'flex';
  bar.style.flexWrap = 'wrap';
  bar.style.justifyContent = 'center';
  bar.style.gap = '8px';
  bar.style.padding = '8px';
  bar.style.background = 'rgba(255, 255, 255, 0.95)';
  bar.style.backdropFilter = 'blur(6px)';
  bar.style.border = '1px solid #d8dee9';
  bar.style.borderRadius = '12px';
  bar.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.15)';
  bar.style.fontFamily = 'sans-serif';

  for (const item of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = item.action;
    button.textContent = item.hint ? `${item.label} (${item.hint})` : item.label;
    button.style.border = '1px solid #cbd5e1';
    button.style.background = '#ffffff';
    button.style.color = '#1e293b';
    button.style.padding = '6px 10px';
    button.style.borderRadius = '10px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '12px';
    button.style.fontWeight = '600';
    button.style.whiteSpace = 'nowrap';
    button.addEventListener('mouseenter', () => {
      button.style.background = '#f8fafc';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#ffffff';
    });
    bar.appendChild(button);
  }

  bar.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('button[data-action]');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const action = button.dataset.action;
    if (!action) {
      return;
    }

    event.preventDefault();
    window.location.href = `elms-ppo://${action}`;
  });

  const mount = () => {
    if (!document.body) {
      window.requestAnimationFrame(mount);
      return;
    }

    document.body.appendChild(bar);

    const paddingBottom = Number.parseInt(window.getComputedStyle(document.body).paddingBottom || '0', 10) || 0;
    if (paddingBottom < 68) {
      document.body.style.paddingBottom = '68px';
    }
  };

  mount();
})();
"#;

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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PpoScreenshotEventPayload {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<&'static str>,
}

fn emit_ppo_screenshot_result(app: &AppHandle, payload: PpoScreenshotEventPayload) {
    let _ = app.emit(PPO_SCREENSHOT_EVENT, payload);
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

fn focus_window(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

fn parse_url(url: &str) -> Option<Url> {
    Url::parse(url).ok()
}

fn parse_toolbar_action(url: &Url) -> Option<String> {
    if url.scheme() != PPO_TOOLBAR_SCHEME {
        return None;
    }

    if let Some(host) = url.host_str() {
        if !host.is_empty() {
            return Some(host.to_string());
        }
    }

    let path = url.path().trim_matches('/');
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

fn inject_toolbar(window: &tauri::WebviewWindow) {
    let _ = window.eval(PPO_TOOLBAR_INJECTION_SCRIPT);
}

fn ppo_screenshot_error_message(code: &'static str) -> &'static str {
    match code {
        PPO_WINDOW_NOT_OPEN => "PPO window is not open.",
        PPO_SCREENSHOT_CAPTURE_FAILED => "Could not capture screenshot.",
        PPO_SCREENSHOT_SAVE_FAILED => "Could not save screenshot.",
        _ => "Screenshot failed.",
    }
}

fn build_ppo_toast_eval_script(message: &str, variant: &str) -> Result<String, serde_json::Error> {
    let message_literal = serde_json::to_string(message)?;
    let variant_literal = serde_json::to_string(variant)?;
    Ok(format!(
        "if (typeof window.__elmsPpoShowToast === 'function') {{ window.__elmsPpoShowToast({message_literal}, {variant_literal}); }}"
    ))
}

fn show_ppo_toast(window: &tauri::WebviewWindow, message: &str, variant: &str) {
    let script = match build_ppo_toast_eval_script(message, variant) {
        Ok(script) => script,
        Err(error) => {
            eprintln!("[ppo] failed to serialize in-window toast payload: {error}");
            return;
        }
    };

    if let Err(error) = window.eval(&script) {
        eprintln!("[ppo] failed to show in-window toast: {error}");
    }
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

fn capture_ppo_window_png(window: &tauri::WebviewWindow) -> Result<Vec<u8>, &'static str> {
    #[cfg(target_os = "linux")]
    {
        use std::sync::mpsc;
        use webkit2gtk::{gio, SnapshotOptions, SnapshotRegion, WebViewExt};

        let (tx, rx) = mpsc::channel::<Result<Vec<u8>, &'static str>>();
        window
            .with_webview(move |platform_webview| {
                let webview = platform_webview.inner();
                let tx_inner = tx.clone();
                webview.snapshot(
                    SnapshotRegion::Visible,
                    SnapshotOptions::NONE,
                    None::<&gio::Cancellable>,
                    move |result| {
                        let capture = match result {
                            Ok(surface) => {
                                let mut bytes = Vec::new();
                                match surface.write_to_png(&mut bytes) {
                                    Ok(_) => Ok(bytes),
                                    Err(_) => Err(PPO_SCREENSHOT_CAPTURE_FAILED),
                                }
                            }
                            Err(_) => Err(PPO_SCREENSHOT_CAPTURE_FAILED),
                        };
                        let _ = tx_inner.send(capture);
                    },
                );
            })
            .map_err(|_| PPO_SCREENSHOT_CAPTURE_FAILED)?;

        rx.recv_timeout(Duration::from_secs(10))
            .unwrap_or(Err(PPO_SCREENSHOT_CAPTURE_FAILED))
    }

    #[cfg(windows)]
    {
        use base64::Engine as _;
        use std::sync::mpsc;
        use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
        use windows_core::HSTRING;

        let (tx, rx) = mpsc::channel::<Result<Vec<u8>, &'static str>>();

        window
            .with_webview(move |platform_webview| {
                let controller = platform_webview.controller();
                let webview = match unsafe { controller.CoreWebView2() } {
                    Ok(webview) => webview,
                    Err(_) => {
                        let _ = tx.send(Err(PPO_SCREENSHOT_CAPTURE_FAILED));
                        return;
                    }
                };

                let tx_callback = tx.clone();
                let callback = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |status, json| {
                        let decoded = if status.is_err() {
                            Err(PPO_SCREENSHOT_CAPTURE_FAILED)
                        } else {
                            let base64_payload = serde_json::from_str::<serde_json::Value>(&json)
                                .ok()
                                .and_then(|value| {
                                    value
                                        .get("data")
                                        .and_then(|data| data.as_str())
                                        .map(str::to_owned)
                                })
                                .ok_or(PPO_SCREENSHOT_CAPTURE_FAILED);

                            match base64_payload {
                                Ok(payload) => base64::engine::general_purpose::STANDARD
                                    .decode(payload)
                                    .map_err(|_| PPO_SCREENSHOT_CAPTURE_FAILED),
                                Err(code) => Err(code),
                            }
                        };

                        let _ = tx_callback.send(decoded);
                        Ok(())
                    },
                ));
                let method = HSTRING::from("Page.captureScreenshot");
                let params = HSTRING::from("{}");

                if unsafe { webview.CallDevToolsProtocolMethod(&method, &params, &callback) }
                    .is_err()
                {
                    let _ = tx.send(Err(PPO_SCREENSHOT_CAPTURE_FAILED));
                }
            })
            .map_err(|_| PPO_SCREENSHOT_CAPTURE_FAILED)?;

        rx.recv_timeout(Duration::from_secs(10))
            .unwrap_or(Err(PPO_SCREENSHOT_CAPTURE_FAILED))
    }

    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = window;
        Err(PPO_SCREENSHOT_CAPTURE_FAILED)
    }
}

fn capture_and_save_ppo_screenshot(
    app: &AppHandle,
    window: &tauri::WebviewWindow,
) -> Result<String, &'static str> {
    let png = capture_ppo_window_png(window)?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let filename = format!("ppo-screenshot-{timestamp}.png");

    let path = desktop_downloads::save_download_bytes(app, &filename, &png)
        .map_err(|_| PPO_SCREENSHOT_SAVE_FAILED)?;

    Ok(path.to_string_lossy().into_owned())
}

fn execute_portal_action(app: &AppHandle, action: &str) -> PpoPortalNavigateResult {
    let Some(window) = app.get_webview_window(PPO_WINDOW_LABEL) else {
        return PpoPortalNavigateResult::error(PPO_WINDOW_NOT_OPEN);
    };

    match action {
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
        "screenshot" => match capture_and_save_ppo_screenshot(app, &window) {
            Ok(path) => {
                show_ppo_toast(&window, &format!("Screenshot saved to {path}"), "success");
                emit_ppo_screenshot_result(
                    app,
                    PpoScreenshotEventPayload {
                        ok: true,
                        path: Some(path.clone()),
                        code: None,
                    },
                );
                PpoPortalNavigateResult::success("screenshot", Some(path))
            }
            Err(code) => {
                show_ppo_toast(&window, ppo_screenshot_error_message(code), "error");
                emit_ppo_screenshot_result(
                    app,
                    PpoScreenshotEventPayload {
                        ok: false,
                        path: None,
                        code: Some(code),
                    },
                );
                PpoPortalNavigateResult::error(code)
            }
        },
        _ => PpoPortalNavigateResult::error(PPO_NAVIGATION_FAILED),
    }
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
    let mut builder =
        tauri::WebviewWindowBuilder::new(&app, PPO_WINDOW_LABEL, WebviewUrl::External(blank_url))
            .title(PPO_WINDOW_TITLE)
            .inner_size(1280.0, 900.0)
            .resizable(true)
            .focused(true);

    let app_for_navigation = app.clone();
    builder = builder
        .on_navigation(move |url| {
            if let Some(action) = parse_toolbar_action(url) {
                let handle = app_for_navigation.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = execute_portal_action(&handle, &action);
                });
                return false;
            }

            true
        })
        .on_page_load(|window, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                inject_toolbar(&window);
            }
        });

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

#[tauri::command]
pub async fn ppo_portal_navigate(app: AppHandle, action: String) -> PpoPortalNavigateResult {
    execute_portal_action(&app, &action)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_ppo_screenshot_error_messages() {
        assert_eq!(
            ppo_screenshot_error_message(PPO_SCREENSHOT_CAPTURE_FAILED),
            "Could not capture screenshot."
        );
        assert_eq!(
            ppo_screenshot_error_message(PPO_SCREENSHOT_SAVE_FAILED),
            "Could not save screenshot."
        );
        assert_eq!(
            ppo_screenshot_error_message(PPO_WINDOW_NOT_OPEN),
            "PPO window is not open."
        );
        assert_eq!(
            ppo_screenshot_error_message("UNKNOWN"),
            "Screenshot failed."
        );
    }

    #[test]
    fn builds_safe_toast_eval_script() {
        let script = build_ppo_toast_eval_script(
            "Saved to C:\\Users\\mk\\Downloads\\ppo \"shot\".png",
            "success",
        )
        .expect("script should serialize");

        assert!(script.contains("window.__elmsPpoShowToast("));
        assert!(script.contains("\\\\"));
        assert!(script.contains("\\\"shot\\\""));
        assert!(script.contains("\"success\""));
    }
}
