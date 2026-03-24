use serde::Serialize;
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const MAX_BACKEND_RESTARTS: u8 = 3;
const BACKEND_SHUTDOWN_GRACE_PERIOD: Duration = Duration::from_secs(5);
const PRISMA_ENGINE_RECURSIVE_SEARCH_DEPTH: usize = 6;
const PRISMA_QUERY_ENGINE_PREFIXES: &[&str] = &["libquery_engine", "query_engine"];

const PRISMA_RUNTIME_PACKAGES: &[&str] = &[
    "@prisma/config",
    "c12",
    "jiti",
    "dotenv",
    "rc9",
    "destr",
    "effect",
    "fast-check",
    "pure-rand",
    "deepmerge-ts",
    "empathic",
    "defu",
];

fn bootstrap_log(message: &str) {
    eprintln!("[desktop-bootstrap] {message}");
}

fn append_bootstrap_log_line(log_file: &Path, message: &str) {
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_file) {
        let _ = writeln!(file, "[desktop-bootstrap] {message}");
    }
}

fn log_startup_diagnostic(log_file: &Path, message: &str) {
    bootstrap_log(message);
    append_bootstrap_log_line(log_file, message);
}

fn parse_truthy(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn generate_bootstrap_token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    format!("{:032x}{:08x}", nanos, std::process::id())
}

fn sanitize_node_options(raw: &str) -> (String, usize) {
    let mut removed = 0usize;
    let filtered = raw
        .split_whitespace()
        .filter(|token| {
            let is_debug_flag = token.contains("--inspect-brk") || token.contains("--inspect");
            if is_debug_flag {
                removed += 1;
            }
            !is_debug_flag
        })
        .collect::<Vec<_>>();

    (filtered.join(" "), removed)
}

fn ensure_node_option(existing: Option<String>, required_token: &str) -> String {
    let mut tokens = existing
        .unwrap_or_default()
        .split_whitespace()
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    if !tokens.iter().any(|token| token == required_token) {
        tokens.push(required_token.to_string());
    }

    tokens.join(" ")
}

fn apply_desktop_runtime_safety_env(effective_env: &mut HashMap<String, String>, log_file: &Path) {
    let current_node_options = effective_env.get("NODE_OPTIONS").cloned();
    let hardened_node_options =
        ensure_node_option(current_node_options, "--max-old-space-size=512");
    effective_env.insert("NODE_OPTIONS".to_string(), hardened_node_options);

    let enable_allocator_checks = effective_env
        .get("ELMS_DESKTOP_ALLOCATOR_CHECKS")
        .map(|value| parse_truthy(value))
        .unwrap_or(false);

    if enable_allocator_checks {
        effective_env
            .entry("MALLOC_CHECK_".to_string())
            .or_insert_with(|| "3".to_string());
        effective_env
            .entry("MALLOC_ARENA_MAX".to_string())
            .or_insert_with(|| "2".to_string());
        append_bootstrap_log_line(
            log_file,
            "Enabled allocator diagnostics (MALLOC_CHECK_=3, MALLOC_ARENA_MAX=2)",
        );
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapStatus {
    phase: String,
    message: Option<String>,
}

impl BootstrapStatus {
    fn new(phase: impl Into<String>, message: Option<String>) -> Self {
        Self {
            phase: phase.into(),
            message,
        }
    }
}

#[derive(Clone)]
struct BackendLaunch {
    program: PathBuf,
    args: Vec<String>,
    current_dir: PathBuf,
    env: HashMap<String, String>,
    log_file: PathBuf,
}

#[derive(Default)]
struct ManagedRuntime {
    backend: Option<Child>,
    backend_launch: Option<BackendLaunch>,
    postgres_data_dir: Option<PathBuf>,
    restart_attempts: u8,
}

struct RuntimeStateInner {
    status: Mutex<BootstrapStatus>,
    runtime: Mutex<ManagedRuntime>,
    is_bootstrapping: AtomicBool,
    is_monitoring: AtomicBool,
    shutting_down: AtomicBool,
}

impl RuntimeStateInner {
    fn set_status(&self, phase: &str, message: Option<String>) {
        let mut status = self.status.lock().expect("runtime status mutex poisoned");
        *status = BootstrapStatus::new(phase, message);
    }

    fn snapshot(&self) -> BootstrapStatus {
        self.status
            .lock()
            .expect("runtime status mutex poisoned")
            .clone()
    }
}

#[derive(Clone)]
pub struct RuntimeState {
    inner: Arc<RuntimeStateInner>,
}

impl Default for RuntimeState {
    fn default() -> Self {
        Self {
            inner: Arc::new(RuntimeStateInner {
                status: Mutex::new(BootstrapStatus::new(
                    "starting",
                    Some("Preparing desktop runtime".to_string()),
                )),
                runtime: Mutex::new(ManagedRuntime::default()),
                is_bootstrapping: AtomicBool::new(false),
                is_monitoring: AtomicBool::new(false),
                shutting_down: AtomicBool::new(false),
            }),
        }
    }
}

#[tauri::command]
pub fn desktop_bootstrap_status(state: State<'_, RuntimeState>) -> BootstrapStatus {
    state.inner.snapshot()
}

#[tauri::command]
pub fn retry_bootstrap(app: AppHandle, state: State<'_, RuntimeState>) -> Result<(), String> {
    if state.inner.is_bootstrapping.load(Ordering::SeqCst) {
        return Ok(());
    }

    state
        .inner
        .set_status("starting", Some("Retrying desktop runtime".to_string()));
    start_runtime_bootstrap(&app);
    Ok(())
}

pub fn start_runtime_bootstrap(app: &AppHandle) {
    let state = app.state::<RuntimeState>();
    let inner = state.inner.clone();

    if inner
        .is_bootstrapping
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    inner.shutting_down.store(false, Ordering::SeqCst);
    inner.set_status(
        "starting",
        Some("Starting embedded PostgreSQL and backend".to_string()),
    );

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = bootstrap_runtime(&app_handle, &inner);
        inner.is_bootstrapping.store(false, Ordering::SeqCst);

        match result {
            Ok(()) => {
                inner.set_status("ready", Some("Desktop runtime ready".to_string()));
                let _ = show_main_window(&app_handle);
                start_monitor_loop(app_handle, inner);
            }
            Err(error) => {
                inner.set_status("failed", Some(error));
                let _ = show_main_window(&app_handle);
            }
        }
    });
}

pub fn shutdown_runtime(app: &AppHandle) {
    let state = app.state::<RuntimeState>();
    let inner = state.inner.clone();
    inner.shutting_down.store(true, Ordering::SeqCst);

    let postgres_data_dir = {
        let mut runtime = inner
            .runtime
            .lock()
            .expect("managed runtime mutex poisoned");
        if let Some(mut child) = runtime.backend.take() {
            terminate_backend_child(&mut child);
        }

        runtime.backend_launch = None;
        runtime.restart_attempts = 0;
        runtime.postgres_data_dir.clone()
    };

    if let Some(data_dir) = postgres_data_dir {
        let _ = stop_postgres(app, &data_dir);
    }
}

fn bootstrap_runtime(app: &AppHandle, inner: &Arc<RuntimeStateInner>) -> Result<(), String> {
    bootstrap_log("Starting runtime bootstrap sequence");

    shutdown_existing_runtime(app, inner)?;

    let app_data_dir = resolve_app_data_dir(app)?;
    let log_dir = app_data_dir.join("logs");
    let postgres_data_dir = app_data_dir.join("postgres");
    fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&postgres_data_dir).map_err(|error| error.to_string())?;
    let bootstrap_log_file = log_dir.join("desktop-bootstrap.log");

    append_bootstrap_log_line(
        &bootstrap_log_file,
        "------------------------------------------------------------",
    );
    log_startup_diagnostic(
        &bootstrap_log_file,
        &format!("App data directory: {}", app_data_dir.display()),
    );
    log_startup_diagnostic(
        &bootstrap_log_file,
        &format!("PostgreSQL data directory: {}", postgres_data_dir.display()),
    );
    let runtime_mode = if should_use_workspace_runtime() {
        "workspace"
    } else {
        "packaged"
    };
    log_startup_diagnostic(
        &bootstrap_log_file,
        &format!("Runtime mode: {runtime_mode}"),
    );
    log_startup_diagnostic(
        &bootstrap_log_file,
        &format!(
            "Desktop bootstrap build version: {}",
            env!("CARGO_PKG_VERSION")
        ),
    );

    for candidate in desktop_env_candidates(app) {
        log_startup_diagnostic(
            &bootstrap_log_file,
            &format!(
                "Desktop env candidate: {} (exists={})",
                candidate.display(),
                candidate.exists()
            ),
        );
    }

    if !should_use_workspace_runtime() {
        validate_packaged_runtime_resources(app, &bootstrap_log_file)?;
    }

    let mut desktop_env = load_desktop_env(app);
    let bootstrap_token = generate_bootstrap_token();
    desktop_env.insert(
        "ELMS_DESKTOP_BOOTSTRAP_TOKEN".to_string(),
        bootstrap_token.clone(),
    );
    desktop_env
        .entry("LOCAL_STORAGE_PATH".to_string())
        .or_insert_with(|| app_data_dir.join("uploads").to_string_lossy().into_owned());
    desktop_env
        .entry("LOCAL_SESSION_STORE_PATH".to_string())
        .or_insert_with(|| {
            app_data_dir
                .join("sessions")
                .join("local-session-store.json")
                .to_string_lossy()
                .into_owned()
        });
    log_startup_diagnostic(
        &bootstrap_log_file,
        "Configured desktop bootstrap token for backend identity verification",
    );
    prepare_prisma_runtime_env(app, &mut desktop_env, &app_data_dir, &bootstrap_log_file)?;
    if let Some(port) = desktop_env.get("BACKEND_PORT") {
        log_startup_diagnostic(
            &bootstrap_log_file,
            &format!("Backend health target: 127.0.0.1:{port}/api/health"),
        );
    }
    inner.set_status(
        "starting",
        Some("Initializing embedded PostgreSQL".to_string()),
    );
    log_startup_diagnostic(&bootstrap_log_file, "Initializing embedded PostgreSQL");
    ensure_postgres_ready(app, &postgres_data_dir, &desktop_env).map_err(|error| {
        append_bootstrap_log_line(
            &bootstrap_log_file,
            &format!("Embedded PostgreSQL startup failed: {error}"),
        );
        error
    })?;

    inner.set_status("starting", Some("Applying database migrations".to_string()));
    let skip_migrations = desktop_env
        .get("ELMS_SKIP_MIGRATIONS")
        .map(|value| parse_truthy(value))
        .unwrap_or_else(|| {
            std::env::var("ELMS_SKIP_MIGRATIONS")
                .ok()
                .map(|value| parse_truthy(&value))
                .unwrap_or(false)
        });

    if skip_migrations {
        log_startup_diagnostic(
            &bootstrap_log_file,
            "Skipping database migrations (ELMS_SKIP_MIGRATIONS=1)",
        );
    } else {
        log_startup_diagnostic(&bootstrap_log_file, "Applying database migrations");
        run_db_migration(app, &desktop_env).map_err(|error| {
            append_bootstrap_log_line(
                &bootstrap_log_file,
                &format!("Database migration failed: {error}"),
            );
            error
        })?;
    }

    let backend_port = desktop_env
        .get("BACKEND_PORT")
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(7854);

    if matches!(
        health_request(
            backend_port,
            desktop_env
                .get("ELMS_DESKTOP_BOOTSTRAP_TOKEN")
                .map(String::as_str)
        ),
        Ok(true)
    ) {
        log_startup_diagnostic(
            &bootstrap_log_file,
            "Detected an already healthy backend; skipping duplicate backend launch",
        );
        let mut runtime = inner
            .runtime
            .lock()
            .expect("managed runtime mutex poisoned");
        runtime.backend = None;
        runtime.backend_launch = None;
        runtime.postgres_data_dir = Some(postgres_data_dir);
        runtime.restart_attempts = 0;
        return Ok(());
    }

    if is_local_port_listening(backend_port) {
        return Err(format!(
            "Desktop backend port 127.0.0.1:{backend_port} is already in use by another process that did not present a valid desktop bootstrap token"
        ));
    }

    inner.set_status("starting", Some("Launching local backend".to_string()));
    log_startup_diagnostic(&bootstrap_log_file, "Resolving backend launch command");
    let launch = resolve_backend_launch(app, &desktop_env, &log_dir).map_err(|error| {
        append_bootstrap_log_line(
            &bootstrap_log_file,
            &format!("Failed to resolve backend launch: {error}"),
        );
        error
    })?;
    log_startup_diagnostic(
        &bootstrap_log_file,
        &format!(
            "Launching backend program='{}' cwd='{}' log='{}'",
            launch.program.display(),
            launch.current_dir.display(),
            launch.log_file.display()
        ),
    );
    let child = spawn_backend(&launch).map_err(|error| {
        append_bootstrap_log_line(
            &bootstrap_log_file,
            &format!("Backend spawn failed: {error}"),
        );
        error
    })?;
    wait_for_backend_health(&desktop_env).map_err(|error| {
        append_bootstrap_log_line(
            &bootstrap_log_file,
            &format!("Backend health check failed: {error}"),
        );
        error
    })?;

    log_startup_diagnostic(&bootstrap_log_file, "Desktop runtime bootstrap completed");

    let mut runtime = inner
        .runtime
        .lock()
        .expect("managed runtime mutex poisoned");
    runtime.backend = Some(child);
    runtime.backend_launch = Some(launch);
    runtime.postgres_data_dir = Some(postgres_data_dir);
    runtime.restart_attempts = 0;
    Ok(())
}

fn shutdown_existing_runtime(
    app: &AppHandle,
    inner: &Arc<RuntimeStateInner>,
) -> Result<(), String> {
    let postgres_data_dir = {
        let mut runtime = inner
            .runtime
            .lock()
            .expect("managed runtime mutex poisoned");
        if let Some(mut child) = runtime.backend.take() {
            terminate_backend_child(&mut child);
        }

        runtime.backend_launch = None;
        runtime.restart_attempts = 0;
        runtime.postgres_data_dir.take()
    };

    if let Some(data_dir) = postgres_data_dir {
        stop_postgres(app, &data_dir)?;
    }

    Ok(())
}

fn terminate_backend_child(child: &mut Child) {
    if matches!(child.try_wait(), Ok(Some(_))) {
        return;
    }

    #[cfg(unix)]
    {
        let pid = child.id() as i32;
        let signal_result = unsafe { libc::kill(pid, libc::SIGTERM) };
        if signal_result == 0 && wait_for_child_exit(child, BACKEND_SHUTDOWN_GRACE_PERIOD) {
            return;
        }
    }

    let _ = child.kill();
    let _ = child.wait();
}

fn wait_for_child_exit(child: &mut Child, timeout: Duration) -> bool {
    let started_at = Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_)) => return true,
            Ok(None) => {
                if started_at.elapsed() >= timeout {
                    return false;
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => return false,
        }
    }
}

fn start_monitor_loop(app: AppHandle, inner: Arc<RuntimeStateInner>) {
    if inner
        .is_monitoring
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    thread::spawn(move || loop {
        if inner.shutting_down.load(Ordering::SeqCst) {
            inner.is_monitoring.store(false, Ordering::SeqCst);
            break;
        }

        if inner.is_bootstrapping.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(750));
            continue;
        }

        let exited = {
            let mut runtime = inner
                .runtime
                .lock()
                .expect("managed runtime mutex poisoned");
            if let Some(child) = runtime.backend.as_mut() {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        runtime.backend = None;
                        Some(format!("Backend exited with status {status}"))
                    }
                    Ok(None) => None,
                    Err(error) => Some(format!("Unable to inspect backend process: {error}")),
                }
            } else {
                None
            }
        };

        if let Some(reason) = exited {
            if recover_backend(&app, &inner, &reason).is_err() {
                let _ = show_main_window(&app);
            }
        }

        thread::sleep(Duration::from_secs(1));
    });
}

fn recover_backend(
    app: &AppHandle,
    inner: &Arc<RuntimeStateInner>,
    reason: &str,
) -> Result<(), String> {
    let launch = {
        let runtime = inner
            .runtime
            .lock()
            .expect("managed runtime mutex poisoned");
        runtime.backend_launch.clone()
    }
    .ok_or_else(|| "Missing backend launch configuration".to_string())?;

    inner.set_status("recovering", Some(reason.to_string()));

    let mut last_error = reason.to_string();
    for attempt in 1..=MAX_BACKEND_RESTARTS {
        if inner.shutting_down.load(Ordering::SeqCst) {
            return Ok(());
        }

        let backend_port = launch
            .env
            .get("BACKEND_PORT")
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(7854);

        if is_local_port_listening(backend_port) {
            last_error = format!(
                "Desktop backend port 127.0.0.1:{backend_port} is already in use by another process that did not present a valid desktop bootstrap token"
            );
            break;
        }

        match spawn_backend(&launch).and_then(|child| {
            wait_for_backend_health(&launch.env)?;
            Ok(child)
        }) {
            Ok(child) => {
                let mut runtime = inner
                    .runtime
                    .lock()
                    .expect("managed runtime mutex poisoned");
                runtime.backend = Some(child);
                runtime.restart_attempts = attempt;
                inner.set_status(
                    "ready",
                    Some(format!("Desktop backend recovered after restart {attempt}")),
                );
                return Ok(());
            }
            Err(error) => {
                last_error = error;
                thread::sleep(Duration::from_secs(1));
            }
        }
    }

    inner.set_status(
        "failed",
        Some(format!(
            "Backend failed after {} restart attempts. Last error: {}",
            MAX_BACKEND_RESTARTS, last_error
        )),
    );
    let _ = show_main_window(app);
    Err(last_error)
}

fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir)
}

fn load_desktop_env(app: &AppHandle) -> HashMap<String, String> {
    let default_node_env = if should_use_workspace_runtime() {
        "development"
    } else {
        "production"
    };

    let mut env = HashMap::from([
        ("NODE_ENV".to_string(), default_node_env.to_string()),
        ("AUTH_MODE".to_string(), "local".to_string()),
        ("STORAGE_DRIVER".to_string(), "local".to_string()),
        ("HOST".to_string(), "127.0.0.1".to_string()),
        ("BACKEND_PORT".to_string(), "7854".to_string()),
        ("FRONTEND_PORT".to_string(), "5173".to_string()),
        (
            "DATABASE_URL".to_string(),
            "postgresql://elms:elms@127.0.0.1:5433/elms_desktop?schema=public".to_string(),
        ),
        (
            "REDIS_URL".to_string(),
            "redis://127.0.0.1:6379".to_string(),
        ),
        ("COOKIE_DOMAIN".to_string(), "localhost".to_string()),
        ("ACCESS_TOKEN_TTL_MINUTES".to_string(), "15".to_string()),
        ("REFRESH_TOKEN_TTL_DAYS".to_string(), "30".to_string()),
        ("LOCAL_SESSION_TTL_HOURS".to_string(), "12".to_string()),
        (
            "DESKTOP_FRONTEND_URL".to_string(),
            "http://127.0.0.1:5173".to_string(),
        ),
        (
            "DESKTOP_BACKEND_URL".to_string(),
            "http://127.0.0.1:7854".to_string(),
        ),
        ("DESKTOP_POSTGRES_PORT".to_string(), "5433".to_string()),
    ]);

    for candidate in desktop_env_candidates(app) {
        if let Ok(contents) = fs::read_to_string(candidate) {
            for raw_line in contents.lines() {
                let line = raw_line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }

                if let Some((key, value)) = line.split_once('=') {
                    env.insert(key.trim().to_string(), value.trim().to_string());
                }
            }
        }
    }

    env
}

fn desktop_env_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if should_use_workspace_runtime() {
        if let Some(root) = workspace_root() {
            candidates.extend(workspace_desktop_env_candidates(&root));
        }
        if let Ok(resource_dir) = app.path().resource_dir() {
            candidates.push(resource_dir.join(".env.desktop"));
        }
    } else {
        if let Ok(resource_dir) = app.path().resource_dir() {
            candidates.push(resource_dir.join(".env.desktop"));
        }
        if let Some(root) = workspace_root() {
            candidates.extend(workspace_desktop_env_candidates(&root));
        }
    }
    candidates
}

fn workspace_desktop_env_candidates(root: &Path) -> Vec<PathBuf> {
    vec![
        root.join("apps/desktop/.env.desktop"),
        root.join("apps/desktop/.env.desktop.example"),
    ]
}

fn resolve_workspace_desktop_env_file(root: &Path) -> PathBuf {
    workspace_desktop_env_candidates(root)
        .into_iter()
        .find(|candidate| candidate.exists())
        .unwrap_or_else(|| root.join("apps/desktop/.env.desktop.example"))
}

fn should_use_workspace_runtime() -> bool {
    if cfg!(debug_assertions) {
        return true;
    }

    std::env::var("ELMS_DESKTOP_USE_WORKSPACE")
        .ok()
        .map(|value| parse_truthy(&value))
        .unwrap_or(false)
}

fn validate_packaged_runtime_resources(app: &AppHandle, log_file: &Path) -> Result<(), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Unable to resolve resource directory: {error}"))?;

    log_startup_diagnostic(
        log_file,
        &format!("Packaged resource directory: {}", resource_dir.display()),
    );

    let required = [
        "packages/frontend/dist/index.html",
        "packages/backend/dist/desktop/server.js",
    ];

    for relative in required {
        let candidate = resource_dir.join(relative);
        if !candidate.exists() {
            let message = format!(
                "Missing bundled resource '{relative}' under {}",
                resource_dir.display()
            );
            log_startup_diagnostic(log_file, &message);
            return Err(message);
        }
    }

    let prisma_cli_candidates = [
        "packages/backend/dist/desktop/node_modules/prisma/build/index.js",
        "packages/backend/dist/desktop/prisma/build/index.js",
        "node_modules/prisma/build/index.js",
    ];

    let resolved_prisma = prisma_cli_candidates
        .iter()
        .map(|relative| resource_dir.join(relative))
        .find(|candidate| candidate.exists());

    if resolved_prisma.is_none() {
        let message = format!(
            "Missing bundled Prisma CLI. Checked: {}",
            prisma_cli_candidates
                .iter()
                .map(|relative| resource_dir.join(relative).display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
        log_startup_diagnostic(log_file, &message);
        return Err(message);
    }

    let prisma_engines_candidates = [
        "packages/backend/dist/desktop/node_modules/@prisma/engines/package.json",
        "packages/backend/dist/desktop/node_modules/@prisma/engines",
        "node_modules/@prisma/engines/package.json",
        "node_modules/@prisma/engines",
        "@prisma/engines/package.json",
        "@prisma/engines",
        "backend/dist/desktop/node_modules/@prisma/engines/package.json",
        "backend/dist/desktop/node_modules/@prisma/engines",
    ];

    let resolved_prisma_engines = prisma_engines_candidates
        .iter()
        .map(|relative| resource_dir.join(relative))
        .find(|candidate| candidate.exists());

    if resolved_prisma_engines.is_none() {
        let message = format!(
            "Missing bundled Prisma engines package. Checked: {}",
            prisma_engines_candidates
                .iter()
                .map(|relative| resource_dir.join(relative).display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
        log_startup_diagnostic(log_file, &message);
        return Err(message);
    }

    let schema_engine_missing =
        resolve_packaged_schema_engine_binary(&resource_dir, log_file).is_none();
    if schema_engine_missing {
        let message = format!(
            "Missing bundled Prisma schema engine binary. Checked directories: {}",
            packaged_prisma_engines_candidate_dirs(&resource_dir)
                .iter()
                .map(|candidate| candidate.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
        log_startup_diagnostic(log_file, &message);
        return Err(message);
    }

    let query_engine_missing =
        resolve_packaged_query_engine_library(&resource_dir, log_file).is_none();
    if query_engine_missing {
        let message = format!(
            "Missing bundled Prisma query engine library. Checked directories: {}",
            packaged_query_engine_candidate_dirs(&resource_dir)
                .iter()
                .map(|candidate| candidate.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        );
        log_startup_diagnostic(log_file, &message);
        return Err(message);
    }

    let missing_config_chain = find_missing_packaged_prisma_packages(&resource_dir);

    if !missing_config_chain.is_empty() {
        let message = format!(
            "Missing bundled Prisma config-chain dependencies: {}",
            missing_config_chain.join(", ")
        );
        log_startup_diagnostic(log_file, &message);
        return Err(message);
    }

    let optional = [
        ".env.desktop",
        "node/node",
        "node/node.exe",
        "postgres/bin/pg_ctl",
        "postgres/bin/pg_ctl.exe",
    ];

    for relative in optional {
        let candidate = resource_dir.join(relative);
        if candidate.exists() {
            append_bootstrap_log_line(
                log_file,
                &format!("Detected bundled runtime file: {}", candidate.display()),
            );
        }
    }

    Ok(())
}

fn workspace_root() -> Option<PathBuf> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .ok()
}

fn ensure_postgres_ready(
    app: &AppHandle,
    data_dir: &Path,
    env: &HashMap<String, String>,
) -> Result<(), String> {
    if !data_dir.join("PG_VERSION").exists() {
        run_postgres_command(app, "initdb", |command| {
            command
                .arg("-A")
                .arg("trust")
                .arg("-U")
                .arg("elms")
                .arg("-D")
                .arg(data_dir);
        })?;
    }

    let log_file = data_dir
        .parent()
        .unwrap_or(data_dir)
        .join("logs")
        .join("postgres.log");
    if let Some(parent) = log_file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let pg_port = env
        .get("DESKTOP_POSTGRES_PORT")
        .map(String::as_str)
        .unwrap_or("5433");

    // On Unix, redirect the socket directory to the app data dir to avoid
    // permission errors with the compiled-in default (/var/run/postgresql).
    #[cfg(unix)]
    let pg_opts = {
        let socket_dir = data_dir.parent().unwrap_or(data_dir);
        format!("-p {} -k {}", pg_port, socket_dir.display())
    };
    #[cfg(not(unix))]
    let pg_opts = format!("-p {}", pg_port);

    // Fast path: server is already accepting connections (e.g. the Tauri
    // process was killed but PostgreSQL kept running). Skip pg_ctl entirely.
    if postgres_is_ready(app, env) {
        create_desktop_database(app, env)?;
        return Ok(());
    }

    // Stale postmaster.pid from a previous crash? Remove it so pg_ctl start
    // won't refuse with "another server might be running".
    let pid_file = data_dir.join("postmaster.pid");
    if pid_file.exists() {
        fs::remove_file(&pid_file)
            .map_err(|e| format!("Unable to remove stale postmaster.pid: {e}"))?;
    }

    let start_result = run_postgres_command(app, "pg_ctl", |command| {
        command
            .arg("-D")
            .arg(data_dir)
            .arg("-l")
            .arg(&log_file)
            .arg("-o")
            .arg(&pg_opts)
            .arg("start");
    });

    if let Err(pg_ctl_error) = start_result {
        // PostgreSQL 16 on Windows exits 1 with "might be running" even when
        // the start actually succeeded. Do a final readiness check before
        // propagating the error.
        if !postgres_is_ready(app, env) {
            return Err(pg_ctl_error);
        }
    }

    wait_for_postgres(app, env)?;
    create_desktop_database(app, env)?;
    Ok(())
}

/// Single-shot pg_isready check (1-second timeout). Returns true if
/// PostgreSQL is already accepting connections on the configured port.
fn postgres_is_ready(app: &AppHandle, env: &HashMap<String, String>) -> bool {
    run_postgres_command(app, "pg_isready", |command| {
        let port = env
            .get("DESKTOP_POSTGRES_PORT")
            .map(String::as_str)
            .unwrap_or("5433");
        command
            .arg("-h")
            .arg("127.0.0.1")
            .arg("-p")
            .arg(port)
            .arg("-U")
            .arg("elms")
            .arg("-t")
            .arg("1");
    })
    .is_ok()
}

fn wait_for_postgres(app: &AppHandle, env: &HashMap<String, String>) -> Result<(), String> {
    let port = env
        .get("DESKTOP_POSTGRES_PORT")
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(5433);
    let started_at = Instant::now();

    loop {
        let status = run_postgres_command(app, "pg_isready", |command| {
            command
                .arg("-h")
                .arg("127.0.0.1")
                .arg("-p")
                .arg(port.to_string())
                .arg("-U")
                .arg("elms");
        });

        if status.is_ok() {
            return Ok(());
        }

        if started_at.elapsed() > Duration::from_secs(25) {
            return Err("Embedded PostgreSQL failed to become ready".to_string());
        }

        thread::sleep(Duration::from_millis(500));
    }
}

fn create_desktop_database(app: &AppHandle, env: &HashMap<String, String>) -> Result<(), String> {
    let database_name = env
        .get("DATABASE_URL")
        .and_then(|value| value.split('/').next_back())
        .and_then(|value| value.split('?').next())
        .unwrap_or("elms_desktop");
    let port = env
        .get("DESKTOP_POSTGRES_PORT")
        .map(String::as_str)
        .unwrap_or("5433");

    let _ = run_postgres_command(app, "createdb", |command| {
        command
            .arg("-h")
            .arg("127.0.0.1")
            .arg("-p")
            .arg(port)
            .arg("-U")
            .arg("elms")
            .arg(database_name);
    });

    Ok(())
}

fn stop_postgres(app: &AppHandle, data_dir: &Path) -> Result<(), String> {
    run_postgres_command(app, "pg_ctl", |command| {
        command
            .arg("-D")
            .arg(data_dir)
            .arg("-m")
            .arg("fast")
            .arg("stop");
    })
}

fn run_db_migration(app: &AppHandle, env: &HashMap<String, String>) -> Result<(), String> {
    if should_use_workspace_runtime() {
        if let Some(root) = workspace_root() {
            if root.join("package.json").exists() {
                // Dev: run via pnpm in the monorepo.
                #[cfg(windows)]
                let pnpm = "pnpm.cmd";
                #[cfg(not(windows))]
                let pnpm = "pnpm";
                let status = Command::new(pnpm)
                    .args([
                        "--filter",
                        "@elms/backend",
                        "exec",
                        "prisma",
                        "migrate",
                        "deploy",
                    ])
                    .current_dir(&root)
                    .envs(env)
                    .status()
                    .map_err(|e| format!("Failed to run prisma migrate: {e}"))?;
                if !status.success() {
                    return Err("Database migration failed".to_string());
                }
                return Ok(());
            }
        }
    }

    // Production: invoke node + the Prisma CLI entry point directly.
    // Using node + prisma/build/index.js rather than the .bin/prisma shell
    // wrapper so this works on Windows where shell wrappers are not executable
    // by Command::new.
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Unable to resolve resource directory: {e}"))?;
    let node_exe = resolve_node_binary(&resource_dir);
    let prisma_cli_candidates = [
        resource_dir.join("packages/backend/dist/desktop/node_modules/prisma/build/index.js"),
        resource_dir.join("packages/backend/dist/desktop/prisma/build/index.js"),
        resource_dir.join("node_modules/prisma/build/index.js"),
    ];

    let prisma_cli = prisma_cli_candidates
        .iter()
        .find(|candidate| candidate.exists())
        .cloned()
        .ok_or_else(|| {
            format!(
                "Prisma CLI not found in bundled runtime. Checked: {}",
                prisma_cli_candidates
                    .iter()
                    .map(|candidate| candidate.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        })?;

    let prisma_engines_candidates = [
        resource_dir
            .join("packages/backend/dist/desktop/node_modules/@prisma/engines/package.json"),
        resource_dir.join("packages/backend/dist/desktop/node_modules/@prisma/engines"),
        resource_dir.join("node_modules/@prisma/engines/package.json"),
        resource_dir.join("node_modules/@prisma/engines"),
    ];

    if !prisma_engines_candidates
        .iter()
        .any(|candidate| candidate.exists())
    {
        return Err(format!(
            "Prisma engines package not found in bundled runtime. Checked: {}",
            prisma_engines_candidates
                .iter()
                .map(|candidate| candidate.display().to_string())
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }

    let missing_config_chain = find_missing_packaged_prisma_packages(&resource_dir);

    if !missing_config_chain.is_empty() {
        return Err(format!(
            "Prisma config-chain dependencies not found in bundled runtime: {}",
            missing_config_chain.join(", ")
        ));
    }

    if !env.contains_key("PRISMA_SCHEMA_ENGINE_BINARY") {
        return Err(
            "PRISMA_SCHEMA_ENGINE_BINARY is not configured for packaged runtime; aborting migration to avoid read-only engine extraction under install directory"
                .to_string(),
        );
    }

    if let Some(schema_engine) = env.get("PRISMA_SCHEMA_ENGINE_BINARY") {
        let schema_engine_path = Path::new(schema_engine);
        if !schema_engine_path.exists() {
            return Err(format!(
                "PRISMA_SCHEMA_ENGINE_BINARY points to a missing file: {}",
                schema_engine_path.display()
            ));
        }
    }

    if !env.contains_key("PRISMA_QUERY_ENGINE_LIBRARY") {
        return Err(
            "PRISMA_QUERY_ENGINE_LIBRARY is not configured for packaged runtime; aborting migration before Prisma attempts runtime engine fallback"
                .to_string(),
        );
    }

    if let Some(query_engine) = env.get("PRISMA_QUERY_ENGINE_LIBRARY") {
        let query_engine_path = Path::new(query_engine);
        if !query_engine_path.exists() {
            return Err(format!(
                "PRISMA_QUERY_ENGINE_LIBRARY points to a missing file: {}",
                query_engine_path.display()
            ));
        }
    }

    let schema = resource_dir.join("packages/backend/prisma/schema.prisma");
    let output = Command::new(&node_exe)
        .arg(&prisma_cli)
        .args(["migrate", "deploy", "--schema"])
        .arg(&schema)
        .current_dir(&resource_dir)
        .envs(env)
        .output()
        .map_err(|e| format!("Failed to run prisma migrate: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("process exited with status {}", output.status)
        };

        return Err(format!("Database migration failed: {detail}"));
    }
    Ok(())
}

fn resolve_backend_launch(
    app: &AppHandle,
    env: &HashMap<String, String>,
    log_dir: &Path,
) -> Result<BackendLaunch, String> {
    let backend_log = log_dir.join("backend.log");

    if let Ok(raw_command) = std::env::var("ELMS_DESKTOP_BACKEND_CMD") {
        // `sh -lc` does not exist on Windows; use cmd /C instead.
        #[cfg(windows)]
        let (program, args) = (PathBuf::from("cmd"), vec!["/C".to_string(), raw_command]);
        #[cfg(not(windows))]
        let (program, args) = (PathBuf::from("sh"), vec!["-lc".to_string(), raw_command]);
        return Ok(BackendLaunch {
            program,
            args,
            current_dir: workspace_root().unwrap_or_else(|| PathBuf::from(".")),
            env: env.clone(),
            log_file: backend_log,
        });
    }

    if should_use_workspace_runtime() {
        if let Some(root) = workspace_root() {
            if root.join("package.json").exists() {
                return workspace_backend_launch(root, env, backend_log);
            }
        }
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Unable to resolve resource directory: {error}"))?;

    let bundled_backend = resource_dir.join("packages/backend/dist/desktop/server.js");
    if bundled_backend.exists() {
        let node_exe = resolve_node_binary(&resource_dir);
        return Ok(BackendLaunch {
            program: node_exe,
            args: vec![bundled_backend.to_string_lossy().into_owned()],
            current_dir: resource_dir,
            env: env.clone(),
            log_file: backend_log,
        });
    }

    Err("Unable to resolve a backend launch command for the desktop shell".to_string())
}

fn workspace_backend_launch(
    root: PathBuf,
    env: &HashMap<String, String>,
    log_file: PathBuf,
) -> Result<BackendLaunch, String> {
    let script = root.join("packages/backend/scripts/dev-local.mjs");
    if !script.exists() {
        return Err(format!(
            "Workspace backend dev launcher not found at {}",
            script.display()
        ));
    }

    let env_file = resolve_workspace_desktop_env_file(&root);

    #[cfg(windows)]
    let program = PathBuf::from("node.exe");
    #[cfg(not(windows))]
    let program = PathBuf::from("node");

    Ok(BackendLaunch {
        program,
        args: vec![
            script.to_string_lossy().into_owned(),
            env_file.to_string_lossy().into_owned(),
        ],
        current_dir: root,
        env: env.clone(),
        log_file,
    })
}

fn spawn_backend(launch: &BackendLaunch) -> Result<Child, String> {
    let allow_debug_flags = launch
        .env
        .get("ELMS_ALLOW_NODE_DEBUG_FLAGS")
        .map(|value| parse_truthy(value))
        .unwrap_or_else(|| {
            std::env::var("ELMS_ALLOW_NODE_DEBUG_FLAGS")
                .ok()
                .map(|value| parse_truthy(&value))
                .unwrap_or(false)
        });

    let mut effective_env = launch.env.clone();
    let mut remove_inherited_node_options = false;

    if !allow_debug_flags {
        let inherited_node_options = std::env::var("NODE_OPTIONS").ok();
        let source_value = effective_env
            .get("NODE_OPTIONS")
            .cloned()
            .or(inherited_node_options.clone());

        if let Some(raw_node_options) = source_value {
            let (sanitized, removed_count) = sanitize_node_options(&raw_node_options);
            if removed_count > 0 {
                if sanitized.is_empty() {
                    effective_env.remove("NODE_OPTIONS");
                    remove_inherited_node_options = true;
                } else {
                    effective_env.insert("NODE_OPTIONS".to_string(), sanitized);
                }

                append_bootstrap_log_line(
                    &launch.log_file,
                    &format!(
                        "Sanitized NODE_OPTIONS by removing {} debugger flag(s). Set ELMS_ALLOW_NODE_DEBUG_FLAGS=1 to keep them.",
                        removed_count
                    ),
                );
            }
        }
    }

    apply_desktop_runtime_safety_env(&mut effective_env, &launch.log_file);

    let stdout_log_path = launch.log_file.with_extension("stdout.log");
    let stderr_log_path = launch.log_file.with_extension("stderr.log");

    let stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stdout_log_path)
        .map_err(|error| format!("Unable to open backend stdout log file: {error}"))?;
    let stderr_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stderr_log_path)
        .map_err(|error| format!("Unable to open backend stderr log file: {error}"))?;

    let mut command = Command::new(&launch.program);
    command
        .args(&launch.args)
        .current_dir(&launch.current_dir)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log));

    if remove_inherited_node_options {
        command.env_remove("NODE_OPTIONS");
    }

    for (key, value) in &effective_env {
        command.env(key, value);
    }

    command
        .spawn()
        .map_err(|error| format!("Unable to start desktop backend: {error}"))
}

fn wait_for_backend_health(env: &HashMap<String, String>) -> Result<(), String> {
    let port = env
        .get("BACKEND_PORT")
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(7854);
    let started_at = Instant::now();
    let expected_bootstrap_token = env.get("ELMS_DESKTOP_BOOTSTRAP_TOKEN").map(String::as_str);

    loop {
        let current_error = match health_request(port, expected_bootstrap_token) {
            Ok(true) => return Ok(()),
            Ok(false) => Some(
                "health endpoint responded without ok=true or with mismatched desktop bootstrap token"
                    .to_string(),
            ),
            Err(error) => Some(error),
        };

        if started_at.elapsed() > Duration::from_secs(30) {
            return Err(format!(
                "Desktop backend failed to become healthy at http://127.0.0.1:{port}/api/health after {}s. Last health error: {}",
                started_at.elapsed().as_secs(),
                current_error.unwrap_or_else(|| "no response yet".to_string())
            ));
        }

        thread::sleep(Duration::from_millis(500));
    }
}

fn health_request(port: u16, expected_bootstrap_token: Option<&str>) -> Result<bool, String> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(1))
        .map_err(|error| error.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(1)))
        .map_err(|error| error.to_string())?;
    stream
        .write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .map_err(|error| error.to_string())?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;

    if !response.contains("\"ok\":true") {
        return Ok(false);
    }

    if let Some(expected_token) = expected_bootstrap_token {
        let token_marker = format!("\"desktopBootstrapToken\":\"{}\"", expected_token);
        return Ok(response.contains(&token_marker));
    }

    Ok(true)
}

fn is_local_port_listening(port: u16) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn run_postgres_command<F>(app: &AppHandle, executable: &str, configure: F) -> Result<(), String>
where
    F: FnOnce(&mut Command),
{
    let binary = resolve_postgres_binary(app, executable);
    let mut command = Command::new(binary);
    configure(&mut command);
    let output = command
        .output()
        .map_err(|error| format!("Unable to run {executable}: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "{executable} failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

fn read_postgres_layout_entry(resource_dir: &Path, key: &str) -> Option<PathBuf> {
    let manifest_path = resource_dir.join("postgres/.layout.env");
    let manifest = fs::read_to_string(manifest_path).ok()?;

    for line in manifest.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let Some((entry_key, entry_value)) = trimmed.split_once('=') else {
            continue;
        };
        if entry_key.trim() != key {
            continue;
        }

        let value = entry_value.trim().trim_matches('"').trim_matches('\'');
        if value.is_empty() {
            return None;
        }

        let relative = Path::new(value);
        if relative.is_absolute() {
            return None;
        }

        if relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        }) {
            return None;
        }

        return Some(resource_dir.join("postgres").join(relative));
    }

    None
}

fn resolve_postgres_binary(app: &AppHandle, executable: &str) -> PathBuf {
    // On Windows all PostgreSQL tools carry a .exe extension.
    #[cfg(windows)]
    let executable = format!("{executable}.exe");
    #[cfg(not(windows))]
    let executable = executable.to_string();

    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(bin_dir) = read_postgres_layout_entry(&resource_dir, "POSTGRES_BIN_DIR") {
            let candidate = bin_dir.join(&executable);
            if candidate.exists() {
                return candidate;
            }
        }
    }

    if let Ok(bin_dir) = std::env::var("ELMS_POSTGRES_BIN_DIR") {
        let candidate = PathBuf::from(bin_dir).join(&executable);
        if candidate.exists() {
            return candidate;
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("postgres/bin").join(&executable);
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from(&executable)
}

/// Resolve the Node.js executable. Prefers the runtime bundled inside the app
/// at `resources/node/node[.exe]`; falls back to `node` on PATH for dev builds.
fn resolve_node_binary(resource_dir: &Path) -> PathBuf {
    #[cfg(windows)]
    let bundled = resource_dir.join("node/node.exe");
    #[cfg(not(windows))]
    let bundled = resource_dir.join("node/node");

    if bundled.exists() {
        return bundled;
    }

    #[cfg(windows)]
    return PathBuf::from("node.exe");
    #[cfg(not(windows))]
    return PathBuf::from("node");
}

fn prepare_prisma_runtime_env(
    app: &AppHandle,
    env: &mut HashMap<String, String>,
    app_data_dir: &Path,
    log_file: &Path,
) -> Result<(), String> {
    let prisma_cache_dir = app_data_dir.join(".prisma");
    let prisma_runtime_dir = prisma_cache_dir.join("engines").join(format!(
        "{}-{}-{}",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH
    ));
    fs::create_dir_all(&prisma_runtime_dir).map_err(|error| error.to_string())?;

    env.insert(
        "PRISMA_QUERY_ENGINE_PATH".to_string(),
        prisma_runtime_dir.to_string_lossy().into_owned(),
    );
    append_bootstrap_log_line(
        log_file,
        &format!(
            "Configured PRISMA_QUERY_ENGINE_PATH={} (writable runtime dir)",
            prisma_runtime_dir.display()
        ),
    );

    if should_use_workspace_runtime() {
        return Ok(());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Unable to resolve resource directory: {error}"))?;

    append_bootstrap_log_line(
        log_file,
        &format!(
            "Preparing Prisma runtime env from packaged resources under {}",
            resource_dir.display()
        ),
    );

    if !env.contains_key("PRISMA_QUERY_ENGINE_LIBRARY") {
        if let Some(engine_path) = resolve_packaged_query_engine_library(&resource_dir, log_file) {
            let runtime_engine =
                sync_prisma_engine_to_runtime(&engine_path, &prisma_runtime_dir, log_file)?;
            env.insert(
                "PRISMA_QUERY_ENGINE_LIBRARY".to_string(),
                runtime_engine.to_string_lossy().into_owned(),
            );
            append_bootstrap_log_line(
                log_file,
                &format!(
                    "Configured PRISMA_QUERY_ENGINE_LIBRARY={} for packaged runtime",
                    runtime_engine.display()
                ),
            );
        } else {
            append_bootstrap_log_line(
                log_file,
                "Unable to resolve packaged Prisma query engine library from known candidates",
            );
        }
    }

    if !env.contains_key("PRISMA_SCHEMA_ENGINE_BINARY") {
        if let Some(schema_engine) = resolve_packaged_schema_engine_binary(&resource_dir, log_file)
        {
            let runtime_schema_engine =
                sync_prisma_engine_to_runtime(&schema_engine, &prisma_runtime_dir, log_file)?;
            env.insert(
                "PRISMA_SCHEMA_ENGINE_BINARY".to_string(),
                runtime_schema_engine.to_string_lossy().into_owned(),
            );
            append_bootstrap_log_line(
                log_file,
                &format!(
                    "Configured PRISMA_SCHEMA_ENGINE_BINARY={} for packaged runtime",
                    runtime_schema_engine.display()
                ),
            );
        } else {
            let candidates = packaged_prisma_engines_candidate_dirs(&resource_dir);
            append_bootstrap_log_line(
                log_file,
                &format!(
                    "Unable to resolve PRISMA_SCHEMA_ENGINE_BINARY from candidates: {}",
                    candidates
                        .iter()
                        .map(|candidate| candidate.display().to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
            );
        }
    }

    env.entry("PRISMA_CLI_QUERY_ENGINE_TYPE".to_string())
        .or_insert_with(|| "library".to_string());

    Ok(())
}

fn find_missing_packaged_prisma_packages(resource_dir: &Path) -> Vec<String> {
    PRISMA_RUNTIME_PACKAGES
        .iter()
        .map(|pkg| pkg.to_string())
        .filter(|pkg| {
            let in_dist = resource_dir
                .join("packages/backend/dist/desktop/node_modules")
                .join(pkg)
                .join("package.json")
                .exists();
            let in_root = resource_dir
                .join("node_modules")
                .join(pkg)
                .join("package.json")
                .exists();
            !in_dist && !in_root
        })
        .collect::<Vec<_>>()
}

fn resolve_packaged_query_engine_library(resource_dir: &Path, log_file: &Path) -> Option<PathBuf> {
    let candidates = packaged_query_engine_candidate_dirs(resource_dir);

    candidates
        .iter()
        .find_map(|dir| find_file_with_prefixes(dir, PRISMA_QUERY_ENGINE_PREFIXES, log_file))
}

fn resolve_packaged_schema_engine_binary(resource_dir: &Path, log_file: &Path) -> Option<PathBuf> {
    let candidates = packaged_prisma_engines_candidate_dirs(resource_dir);

    if let Some(schema_engine) = candidates
        .iter()
        .find_map(|dir| find_file_with_prefix(dir, "schema-engine", log_file))
    {
        return Some(schema_engine);
    }

    append_bootstrap_log_line(
        log_file,
        &format!(
            "Primary schema-engine lookup failed; starting bounded recursive search from {} (max_depth={})",
            resource_dir.display(),
            PRISMA_ENGINE_RECURSIVE_SEARCH_DEPTH
        ),
    );

    let recursive_match = find_file_with_prefix_recursive(
        resource_dir,
        "schema-engine",
        PRISMA_ENGINE_RECURSIVE_SEARCH_DEPTH,
        log_file,
    );

    if let Some(found) = &recursive_match {
        append_bootstrap_log_line(
            log_file,
            &format!(
                "Resolved schema-engine via recursive search: {}",
                found.display()
            ),
        );
    } else {
        append_bootstrap_log_line(
            log_file,
            "Recursive schema-engine search did not find a matching file",
        );
    }

    recursive_match
}

fn packaged_query_engine_candidate_dirs(resource_dir: &Path) -> [PathBuf; 6] {
    [
        resource_dir.join("packages/backend/dist/desktop/node_modules/.prisma/client"),
        resource_dir.join("node_modules/.prisma/client"),
        resource_dir.join("packages/backend/dist/desktop/node_modules/@prisma/engines"),
        resource_dir.join("node_modules/@prisma/engines"),
        resource_dir.join("@prisma/engines"),
        resource_dir.join("backend/dist/desktop/node_modules/@prisma/engines"),
    ]
}

fn packaged_prisma_engines_candidate_dirs(resource_dir: &Path) -> [PathBuf; 4] {
    [
        resource_dir.join("packages/backend/dist/desktop/node_modules/@prisma/engines"),
        resource_dir.join("node_modules/@prisma/engines"),
        resource_dir.join("@prisma/engines"),
        resource_dir.join("backend/dist/desktop/node_modules/@prisma/engines"),
    ]
}

fn find_file_with_prefix(dir: &Path, prefix: &str, log_file: &Path) -> Option<PathBuf> {
    find_file_with_prefixes(dir, &[prefix], log_file)
}

fn find_file_with_prefixes(dir: &Path, prefixes: &[&str], log_file: &Path) -> Option<PathBuf> {
    if !dir.exists() {
        append_bootstrap_log_line(
            log_file,
            &format!(
                "Prisma runtime search skipped missing directory: {}",
                dir.display()
            ),
        );
        return None;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            append_bootstrap_log_line(
                log_file,
                &format!(
                    "Unable to read Prisma runtime directory {}: {}",
                    dir.display(),
                    error
                ),
            );
            return None;
        }
    };

    let mut had_entries = false;
    for entry in entries.flatten() {
        had_entries = true;
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                append_bootstrap_log_line(
                    log_file,
                    &format!(
                        "Unable to inspect Prisma runtime entry in {}: {}",
                        dir.display(),
                        error
                    ),
                );
                continue;
            }
        };
        if !file_type.is_file() {
            continue;
        }

        let name = entry.file_name();
        if prefixes
            .iter()
            .any(|prefix| name.to_string_lossy().starts_with(prefix))
        {
            return Some(path);
        }
    }

    if had_entries {
        append_bootstrap_log_line(
            log_file,
            &format!(
                "No Prisma runtime file with prefixes [{}] found in {}",
                prefixes.join(", "),
                dir.display()
            ),
        );
    }

    None
}

fn sync_prisma_engine_to_runtime(
    source_engine: &Path,
    runtime_dir: &Path,
    log_file: &Path,
) -> Result<PathBuf, String> {
    let file_name = source_engine
        .file_name()
        .ok_or_else(|| format!("Invalid Prisma engine path: {}", source_engine.display()))?;
    let destination = runtime_dir.join(file_name);

    let should_copy = match (fs::metadata(source_engine), fs::metadata(&destination)) {
        (Ok(source_meta), Ok(destination_meta)) => source_meta.len() != destination_meta.len(),
        (Ok(_), Err(_)) => true,
        (Err(error), _) => {
            return Err(format!(
                "Unable to inspect Prisma engine source {}: {}",
                source_engine.display(),
                error
            ));
        }
    };

    if should_copy {
        fs::copy(source_engine, &destination).map_err(|error| {
            format!(
                "Unable to copy Prisma engine from {} to {}: {}",
                source_engine.display(),
                destination.display(),
                error
            )
        })?;

        // Keep executable mode for binaries like schema-engine on Unix targets.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            if let Ok(source_meta) = fs::metadata(source_engine) {
                let _ = fs::set_permissions(
                    &destination,
                    fs::Permissions::from_mode(source_meta.permissions().mode()),
                );
            }
        }

        append_bootstrap_log_line(
            log_file,
            &format!(
                "Synced Prisma engine to writable runtime dir: {} -> {}",
                source_engine.display(),
                destination.display()
            ),
        );
    } else {
        append_bootstrap_log_line(
            log_file,
            &format!(
                "Using existing Prisma runtime engine copy: {}",
                destination.display()
            ),
        );
    }

    Ok(destination)
}

fn find_file_with_prefix_recursive(
    dir: &Path,
    prefix: &str,
    max_depth: usize,
    log_file: &Path,
) -> Option<PathBuf> {
    if max_depth == 0 {
        return None;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            append_bootstrap_log_line(
                log_file,
                &format!(
                    "Unable to recursively read Prisma runtime directory {}: {}",
                    dir.display(),
                    error
                ),
            );
            return None;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };

        if file_type.is_file() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with(prefix) {
                return Some(path);
            }
            continue;
        }

        if file_type.is_dir() {
            if let Some(found) =
                find_file_with_prefix_recursive(&path, prefix, max_depth - 1, log_file)
            {
                return Some(found);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::workspace_backend_launch;
    use std::collections::HashMap;
    use std::path::Path;
    use std::path::PathBuf;

    #[test]
    fn workspace_backend_launch_uses_node_dev_launcher_directly() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../..")
            .canonicalize()
            .expect("workspace root should resolve");
        let log_file = root.join("target/test-backend.log");
        let launch =
            workspace_backend_launch(root.clone(), &HashMap::new(), log_file.clone()).unwrap();

        #[cfg(windows)]
        assert_eq!(launch.program, PathBuf::from("node.exe"));
        #[cfg(not(windows))]
        assert_eq!(launch.program, PathBuf::from("node"));

        assert_eq!(launch.current_dir, root);
        assert_eq!(launch.log_file, log_file);
        assert_eq!(launch.args.len(), 2);
        assert!(
            launch.args[0].ends_with("packages/backend/scripts/dev-local.mjs"),
            "expected direct dev launcher path, got {}",
            launch.args[0]
        );
        assert!(
            launch.args[1].ends_with("apps/desktop/.env.desktop")
                || launch.args[1].ends_with("apps/desktop/.env.desktop.example"),
            "expected desktop env-file path, got {}",
            launch.args[1]
        );
        assert!(
            Path::new(&launch.args[1]).exists()
                || launch.args[1].ends_with("apps/desktop/.env.desktop.example"),
            "expected resolved env-file path to exist or fall back to the checked-in example, got {}",
            launch.args[1]
        );
        assert!(
            !launch
                .args
                .iter()
                .any(|arg| arg == "pnpm" || arg == "@elms/backend" || arg == "dev:local"),
            "workspace launch should not go through pnpm"
        );
    }
}
