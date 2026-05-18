use chrono::{Datelike, Local, TimeZone};
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::fs::File;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::sidecar;

const BACKUP_POLICY_FILE: &str = "desktop-backup-policy.json";
const BACKUP_EXTENSION: &str = "elmsbk";
const DEFAULT_BACKUP_RETENTION: u16 = 14;
const DEFAULT_BACKUP_TIME_LOCAL: &str = "02:00";
const MIGRATION_VERSION_MARKER_FILE: &str = "migration_version";
const FORCE_MIGRATION_MARKER_FILE: &str = "force_migration_on_next_boot";
const FIRM_ADMIN_ROLE_KEY: &str = "firm_admin";

#[derive(Default)]
pub struct BackupState {
    operation_in_progress: Mutex<bool>,
    scheduler_started: AtomicBool,
}

struct OperationGuard<'a> {
    state: &'a BackupState,
}

impl Drop for OperationGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut lock) = self.state.operation_in_progress.lock() {
            *lock = false;
        }
    }
}

fn begin_operation(state: &BackupState) -> Result<OperationGuard<'_>, String> {
    let mut lock = state
        .operation_in_progress
        .lock()
        .map_err(|_| "Backup operation lock is unavailable".to_string())?;
    if *lock {
        return Err("Another backup/restore operation is already running".to_string());
    }

    *lock = true;
    Ok(OperationGuard { state })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPolicy {
    pub enabled: bool,
    pub frequency: BackupFrequency,
    pub time_local: String,
    pub weekly_day: Option<u8>,
    pub retention_count: u16,
}

impl Default for BackupPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            frequency: BackupFrequency::Daily,
            time_local: DEFAULT_BACKUP_TIME_LOCAL.to_string(),
            weekly_day: None,
            retention_count: DEFAULT_BACKUP_RETENTION,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BackupFrequency {
    Daily,
    Weekly,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredBackupPolicy {
    #[serde(default)]
    policy: BackupPolicy,
    backup_directory: Option<String>,
    last_backup_at: Option<String>,
    last_backup_result: Option<String>,
    last_backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFileItem {
    path: String,
    name: String,
    size_bytes: u64,
    modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPolicyResponse {
    policy: BackupPolicy,
    effective_backup_directory: String,
    configured_backup_directory: Option<String>,
    backups: Vec<BackupFileItem>,
    last_backup_at: Option<String>,
    last_backup_result: Option<String>,
    last_backup_path: Option<String>,
    next_scheduled_backup_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetBackupPolicyInput {
    enabled: bool,
    frequency: BackupFrequency,
    time_local: String,
    weekly_day: Option<u8>,
    retention_count: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupInput {
    backup_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupOperationResult {
    ok: bool,
    message: String,
    backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    version: u8,
    created_at: String,
    app_version: String,
    database_name: String,
    storage_path: String,
}

#[derive(Debug, Clone)]
struct PreservedFirmAdminCredential {
    id: String,
    email: String,
    full_name: String,
    preferred_language: String,
    status: String,
    password_hash: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    sidecar::resolve_desktop_app_data_dir(app)
}

fn policy_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(BACKUP_POLICY_FILE))
}

fn parse_time_local(value: &str) -> Result<(u32, u32), String> {
    let (h, m) = value
        .trim()
        .split_once(':')
        .ok_or_else(|| "timeLocal must be in HH:mm format".to_string())?;
    let hour = h
        .parse::<u32>()
        .map_err(|_| "timeLocal hour must be a number".to_string())?;
    let minute = m
        .parse::<u32>()
        .map_err(|_| "timeLocal minute must be a number".to_string())?;

    if hour > 23 || minute > 59 {
        return Err("timeLocal must be a valid 24-hour time".to_string());
    }

    Ok((hour, minute))
}

fn validate_policy(policy: &BackupPolicy) -> Result<(), String> {
    let _ = parse_time_local(&policy.time_local)?;

    if !(1..=365).contains(&policy.retention_count) {
        return Err("retentionCount must be between 1 and 365".to_string());
    }

    match policy.frequency {
        BackupFrequency::Daily => {}
        BackupFrequency::Weekly => {
            let day = policy
                .weekly_day
                .ok_or_else(|| "weeklyDay is required for weekly backups".to_string())?;
            if day > 6 {
                return Err("weeklyDay must be between 0 and 6".to_string());
            }
        }
    }

    Ok(())
}

fn load_stored_policy(app: &AppHandle) -> Result<StoredBackupPolicy, String> {
    let path = policy_file_path(app)?;
    if !path.exists() {
        return Ok(StoredBackupPolicy::default());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read backup policy: {error}"))?;
    let parsed = serde_json::from_str::<StoredBackupPolicy>(&raw)
        .map_err(|error| format!("Unable to parse backup policy: {error}"))?;
    validate_policy(&parsed.policy)?;
    Ok(parsed)
}

fn save_stored_policy(app: &AppHandle, policy: &StoredBackupPolicy) -> Result<(), String> {
    validate_policy(&policy.policy)?;
    let path = policy_file_path(app)?;
    let encoded = serde_json::to_vec_pretty(policy)
        .map_err(|error| format!("Unable to encode backup policy: {error}"))?;
    fs::write(path, encoded).map_err(|error| format!("Unable to save backup policy: {error}"))
}

fn default_backup_directory(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(home) = app.path().home_dir() {
        return Ok(home.join("elms-backups"));
    }

    Ok(app_data_dir(app)?.join("backups"))
}

fn configured_backup_directory(stored: &StoredBackupPolicy) -> Option<PathBuf> {
    let configured = stored.backup_directory.as_ref()?.trim();
    if configured.is_empty() {
        return None;
    }
    Some(PathBuf::from(configured))
}

fn effective_backup_directory(
    app: &AppHandle,
    stored: &StoredBackupPolicy,
) -> Result<PathBuf, String> {
    Ok(configured_backup_directory(stored).unwrap_or(default_backup_directory(app)?))
}

fn system_time_to_iso(value: SystemTime) -> Option<String> {
    let dt = chrono::DateTime::<chrono::Utc>::from(value);
    Some(dt.to_rfc3339())
}

fn list_backups_in_dir(dir: &Path) -> Result<Vec<BackupFileItem>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups = fs::read_dir(dir)
        .map_err(|error| format!("Unable to list backups directory: {error}"))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(OsStr::to_str) != Some(BACKUP_EXTENSION) {
                return None;
            }

            let metadata = entry.metadata().ok()?;
            Some((path, metadata))
        })
        .collect::<Vec<_>>();

    backups.sort_by(|a, b| {
        let a_time = a.1.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        let b_time = b.1.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        b_time.cmp(&a_time)
    });

    Ok(backups
        .into_iter()
        .map(|(path, metadata)| BackupFileItem {
            path: path.to_string_lossy().into_owned(),
            name: path
                .file_name()
                .and_then(OsStr::to_str)
                .unwrap_or("backup.elmsbk")
                .to_string(),
            size_bytes: metadata.len(),
            modified_at: metadata.modified().ok().and_then(system_time_to_iso),
        })
        .collect())
}

fn parse_log_port(app_data_dir: &Path) -> Option<u16> {
    let log_path = app_data_dir.join("logs").join("desktop-bootstrap.log");
    let contents = fs::read_to_string(log_path).ok()?;

    for line in contents.lines().rev() {
        if let Some((_, rhs)) = line.split_once("Embedded PostgreSQL port:") {
            if let Ok(port) = rhs.trim().parse::<u16>() {
                return Some(port);
            }
        }
    }

    None
}

fn infer_postgres_port(app_data_dir: &Path) -> u16 {
    if let Ok(raw) = std::env::var("DESKTOP_POSTGRES_PORT") {
        if let Ok(port) = raw.trim().parse::<u16>() {
            return port;
        }
    }

    parse_log_port(app_data_dir).unwrap_or(5433)
}

fn infer_database_name(app_data_dir: &Path) -> String {
    let marker = app_data_dir.join("desktop-database-name");
    if let Ok(raw) = fs::read_to_string(marker) {
        let value = raw.trim();
        if !value.is_empty() {
            return value.to_string();
        }
    }

    "elms_desktop".to_string()
}

fn apply_postgres_runtime_env(app: &AppHandle, command: &mut Command) {
    let Ok(path) = app.path().resource_dir() else {
        return;
    };
    let resource_dir = sidecar::strip_unc_prefix(&path);
    let manifest_path = resource_dir.join("postgres/.layout.env");
    let Ok(manifest) = fs::read_to_string(manifest_path) else {
        return;
    };

    let mut runtime_lib_dir: Option<PathBuf> = None;
    for line in manifest.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        if key.trim() != "POSTGRES_RUNTIME_LIB_DIR" {
            continue;
        }

        let relative = value.trim().trim_matches('"').trim_matches('\'');
        if !relative.is_empty() {
            runtime_lib_dir = Some(resource_dir.join("postgres").join(relative));
        }
    }

    let Some(runtime_lib_dir) = runtime_lib_dir else {
        return;
    };
    if !runtime_lib_dir.exists() {
        return;
    }

    let mut combined_paths = vec![runtime_lib_dir];
    if let Some(existing_path) = std::env::var_os("PATH") {
        combined_paths.extend(std::env::split_paths(&existing_path));
    }

    if let Ok(path_value) = std::env::join_paths(combined_paths) {
        command.env("PATH", path_value);
    }
}

fn run_pg_dump(
    app: &AppHandle,
    output_gzip_path: &Path,
    port: u16,
    database: &str,
) -> Result<(), String> {
    let pg_dump = sidecar::resolve_postgres_binary(app, "pg_dump");
    let mut command = Command::new(pg_dump);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    apply_postgres_runtime_env(app, &mut command);

    let mut child = command
        .args([
            "-h",
            "127.0.0.1",
            "-p",
            &port.to_string(),
            "-U",
            "elms",
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            database,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to start pg_dump: {error}"))?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Unable to capture pg_dump stdout".to_string())?;

    let output_file = File::create(output_gzip_path).map_err(|error| {
        format!(
            "Unable to create dump file {}: {error}",
            output_gzip_path.display()
        )
    })?;
    let mut gzip = GzEncoder::new(output_file, Compression::default());
    std::io::copy(&mut stdout, &mut gzip)
        .map_err(|error| format!("Unable to stream pg_dump output: {error}"))?;
    gzip.finish()
        .map_err(|error| format!("Unable to finalize dump gzip stream: {error}"))?;

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Unable to collect pg_dump output: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        return Err(format!("pg_dump failed with status {}", output.status));
    }

    Err(format!("pg_dump failed: {stderr}"))
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "Unable to create directory {}: {error}",
            destination.display()
        )
    })?;

    for entry in fs::read_dir(source)
        .map_err(|error| format!("Unable to read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("Unable to read directory entry: {error}"))?;
        let source_path = entry.path();
        let dest_path = destination.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!(
                        "Unable to create parent directory {}: {error}",
                        parent.display()
                    )
                })?;
            }
            fs::copy(&source_path, &dest_path).map_err(|error| {
                format!(
                    "Unable to copy file {} to {}: {error}",
                    source_path.display(),
                    dest_path.display()
                )
            })?;
        }
    }

    Ok(())
}

fn create_backup_archive(
    output_path: &Path,
    manifest: &BackupManifest,
    database_dump_path: &Path,
    uploads_snapshot_path: &Path,
) -> Result<(), String> {
    let archive_file = File::create(output_path).map_err(|error| {
        format!(
            "Unable to create backup archive {}: {error}",
            output_path.display()
        )
    })?;
    let encoder = GzEncoder::new(archive_file, Compression::default());
    let mut builder = tar::Builder::new(encoder);

    let manifest_json = serde_json::to_vec_pretty(manifest)
        .map_err(|error| format!("Unable to serialize backup manifest: {error}"))?;
    let mut header = tar::Header::new_gnu();
    header.set_size(manifest_json.len() as u64);
    header.set_mode(0o644);
    header.set_cksum();
    builder
        .append_data(&mut header, "manifest.json", manifest_json.as_slice())
        .map_err(|error| format!("Unable to append manifest to backup archive: {error}"))?;

    builder
        .append_path_with_name(database_dump_path, "database.sql.gz")
        .map_err(|error| format!("Unable to append database dump to backup archive: {error}"))?;

    if uploads_snapshot_path.exists() {
        builder
            .append_dir_all("uploads", uploads_snapshot_path)
            .map_err(|error| {
                format!("Unable to append uploads directory to backup archive: {error}")
            })?;
    }

    builder
        .finish()
        .map_err(|error| format!("Unable to finalize backup archive: {error}"))?;

    Ok(())
}

fn prune_backups(
    backup_dir: &Path,
    retention_count: u16,
    preserve_path: Option<&Path>,
) -> Result<(), String> {
    let backups = list_backups_in_dir(backup_dir)?;
    let preserve_canonical = preserve_path.and_then(|path| fs::canonicalize(path).ok());
    for backup in backups.into_iter().skip(retention_count as usize) {
        let candidate_path = PathBuf::from(&backup.path);
        if let Some(ref preserved) = preserve_canonical {
            if fs::canonicalize(&candidate_path)
                .ok()
                .as_ref()
                .is_some_and(|value| value == preserved)
            {
                continue;
            }
        }
        fs::remove_file(candidate_path)
            .map_err(|error| format!("Unable to delete old backup: {error}"))?;
    }

    Ok(())
}

#[derive(Clone, Copy)]
enum BackupTrigger {
    Manual,
    Scheduled,
    PreRestore,
}

fn backup_filename(trigger: BackupTrigger) -> String {
    let timestamp = Local::now().format("%Y%m%dT%H%M%S");
    match trigger {
        BackupTrigger::Manual => format!("elms-backup-{timestamp}.{BACKUP_EXTENSION}"),
        BackupTrigger::Scheduled => format!("elms-backup-auto-{timestamp}.{BACKUP_EXTENSION}"),
        BackupTrigger::PreRestore => format!("elms-pre-restore-{timestamp}.{BACKUP_EXTENSION}"),
    }
}

fn persist_backup_result(
    app: &AppHandle,
    stored: &mut StoredBackupPolicy,
    success: bool,
    message: String,
    backup_path: Option<String>,
) -> Result<(), String> {
    stored.last_backup_at = Some(chrono::Utc::now().to_rfc3339());
    stored.last_backup_result = Some(if success { "success" } else { "error" }.to_string());
    stored.last_backup_path = backup_path;

    save_stored_policy(app, stored)?;

    if !success {
        return Err(message);
    }

    Ok(())
}

fn run_backup_internal(
    app: &AppHandle,
    trigger: BackupTrigger,
    preserve_path: Option<&Path>,
) -> Result<PathBuf, String> {
    let app_data = app_data_dir(app)?;
    let mut stored = load_stored_policy(app)?;
    let backup_dir = effective_backup_directory(app, &stored)?;
    fs::create_dir_all(&backup_dir).map_err(|error| {
        format!(
            "Unable to create backup directory {}: {error}",
            backup_dir.display()
        )
    })?;

    let work_dir = app_data
        .join("backup-work")
        .join(format!("{}", Local::now().timestamp_millis()));
    fs::create_dir_all(&work_dir)
        .map_err(|error| format!("Unable to create backup temp directory: {error}"))?;

    let cleanup = || {
        let _ = fs::remove_dir_all(&work_dir);
    };

    let result = (|| -> Result<PathBuf, String> {
        let port = infer_postgres_port(&app_data);
        let database_name = infer_database_name(&app_data);
        let uploads_dir = app_data.join("uploads");

        let dump_path = work_dir.join("database.sql.gz");
        run_pg_dump(app, &dump_path, port, &database_name)?;

        let uploads_snapshot_path = work_dir.join("uploads");
        copy_dir_recursive(&uploads_dir, &uploads_snapshot_path)?;

        let manifest = BackupManifest {
            version: 1,
            created_at: chrono::Utc::now().to_rfc3339(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            database_name,
            storage_path: uploads_dir.to_string_lossy().into_owned(),
        };

        let backup_name = backup_filename(trigger);
        let backup_path = backup_dir.join(backup_name);
        create_backup_archive(&backup_path, &manifest, &dump_path, &uploads_snapshot_path)?;

        prune_backups(&backup_dir, stored.policy.retention_count, preserve_path)?;
        Ok(backup_path)
    })();

    match result {
        Ok(path) => {
            let _ = persist_backup_result(
                app,
                &mut stored,
                true,
                "Backup completed".to_string(),
                Some(path.to_string_lossy().into_owned()),
            );
            cleanup();
            Ok(path)
        }
        Err(error) => {
            let _ = persist_backup_result(app, &mut stored, false, error.clone(), None);
            cleanup();
            Err(error)
        }
    }
}

fn validate_archive_relative_path(path: &Path) -> Result<PathBuf, String> {
    if path.as_os_str().is_empty() {
        return Err("Backup archive contains an empty entry path".to_string());
    }

    if path.is_absolute() {
        return Err(format!(
            "Backup archive contains an absolute entry path: {}",
            path.display()
        ));
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => normalized.push(value),
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(format!(
                    "Backup archive contains an unsafe parent path segment: {}",
                    path.display()
                ))
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(format!(
                    "Backup archive contains an unsafe entry path: {}",
                    path.display()
                ))
            }
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err("Backup archive contains an empty normalized entry path".to_string());
    }

    let mut components = normalized.components();
    let Some(Component::Normal(first)) = components.next() else {
        return Err(format!(
            "Backup archive contains an invalid entry path: {}",
            path.display()
        ));
    };

    let first = first.to_string_lossy();
    if normalized == Path::new("manifest.json")
        || normalized == Path::new("database.sql.gz")
        || first == "uploads"
    {
        return Ok(normalized);
    }

    Err(format!(
        "Backup archive contains an unexpected entry path: {}",
        path.display()
    ))
}

fn ensure_path_within_directory(root: &Path, target: &Path) -> Result<(), String> {
    let canonical_root = fs::canonicalize(root)
        .map_err(|error| format!("Unable to canonicalize restore workspace: {error}"))?;
    let canonical_target = fs::canonicalize(target)
        .map_err(|error| format!("Unable to canonicalize restore target path: {error}"))?;

    if canonical_target.starts_with(&canonical_root) {
        return Ok(());
    }

    Err(format!(
        "Backup archive entry resolves outside restore workspace: {}",
        target.display()
    ))
}

fn is_disallowed_archive_entry_type(entry_type: tar::EntryType) -> bool {
    entry_type.is_symlink() || entry_type.is_hard_link()
}

fn extract_archive(backup_path: &Path, destination: &Path) -> Result<(), String> {
    let file = File::open(backup_path).map_err(|error| {
        format!(
            "Unable to open backup file {}: {error}",
            backup_path.display()
        )
    })?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    let entries = archive
        .entries()
        .map_err(|error| format!("Unable to inspect backup archive: {error}"))?;

    for entry in entries {
        let mut entry =
            entry.map_err(|error| format!("Unable to read backup archive entry: {error}"))?;
        let entry_type = entry.header().entry_type();
        if is_disallowed_archive_entry_type(entry_type) {
            return Err("Backup archive contains unsupported link entries".to_string());
        }

        let raw_path = entry
            .path()
            .map_err(|error| format!("Unable to parse backup archive entry path: {error}"))?;
        let relative_path = validate_archive_relative_path(&raw_path)?;
        let target_path = destination.join(&relative_path);

        if entry_type.is_dir() {
            fs::create_dir_all(&target_path).map_err(|error| {
                format!(
                    "Unable to create restore directory {}: {error}",
                    target_path.display()
                )
            })?;
            ensure_path_within_directory(destination, &target_path)?;
            continue;
        }

        if !entry_type.is_file() {
            return Err(format!(
                "Backup archive contains unsupported entry type for {}",
                relative_path.display()
            ));
        }

        let parent = target_path.parent().ok_or_else(|| {
            format!(
                "Backup archive contains an invalid entry path: {}",
                relative_path.display()
            )
        })?;
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Unable to create restore parent directory {}: {error}",
                parent.display()
            )
        })?;
        ensure_path_within_directory(destination, parent)?;
        entry.unpack(&target_path).map_err(|error| {
            format!(
                "Unable to extract backup archive entry {}: {error}",
                relative_path.display()
            )
        })?;
        ensure_path_within_directory(destination, &target_path)?;
    }

    Ok(())
}

fn read_manifest(path: &Path) -> Result<BackupManifest, String> {
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Unable to read backup manifest: {error}"))?;
    serde_json::from_str::<BackupManifest>(&raw)
        .map_err(|error| format!("Unable to parse backup manifest: {error}"))
}

fn run_psql_restore(
    app: &AppHandle,
    sql_path: &Path,
    port: u16,
    database: &str,
) -> Result<(), String> {
    let psql = sidecar::resolve_postgres_binary(app, "psql");
    let mut command = Command::new(psql);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    apply_postgres_runtime_env(app, &mut command);

    let args = build_psql_restore_args(sql_path, port, database);

    let output = command
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Unable to start psql: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        return Err(format!("psql restore failed with status {}", output.status));
    }

    Err(format!("psql restore failed: {stderr}"))
}

fn run_psql_capture_output(
    app: &AppHandle,
    port: u16,
    database: &str,
    sql: &str,
) -> Result<String, String> {
    let psql = sidecar::resolve_postgres_binary(app, "psql");
    let mut command = Command::new(psql);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    apply_postgres_runtime_env(app, &mut command);
    command.env("PGPASSWORD", "elms");

    let output = command
        .args([
            "-h",
            "127.0.0.1",
            "-p",
            &port.to_string(),
            "-U",
            "elms",
            "-d",
            database,
            "-X",
            "-A",
            "-t",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Unable to run psql query: {error}"))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        return Err(format!("psql query failed with status {}", output.status));
    }

    Err(format!("psql query failed: {stderr}"))
}

fn run_psql_execute_sql(
    app: &AppHandle,
    port: u16,
    database: &str,
    sql: &str,
) -> Result<(), String> {
    let psql = sidecar::resolve_postgres_binary(app, "psql");
    let mut command = Command::new(psql);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    apply_postgres_runtime_env(app, &mut command);
    command.env("PGPASSWORD", "elms");

    let output = command
        .args([
            "-h",
            "127.0.0.1",
            "-p",
            &port.to_string(),
            "-U",
            "elms",
            "-d",
            database,
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Unable to run psql command: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        return Err(format!("psql command failed with status {}", output.status));
    }

    Err(format!("psql command failed: {stderr}"))
}

fn build_psql_restore_args(sql_path: &Path, port: u16, database: &str) -> Vec<String> {
    vec![
        "-h".to_string(),
        "127.0.0.1".to_string(),
        "-p".to_string(),
        port.to_string(),
        "-U".to_string(),
        "elms".to_string(),
        "-d".to_string(),
        database.to_string(),
        "-v".to_string(),
        "ON_ERROR_STOP=1".to_string(),
        "--single-transaction".to_string(),
        "-f".to_string(),
        sql_path.to_string_lossy().into_owned(),
    ]
}

fn sql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn preserve_firm_admin_credentials(
    app: &AppHandle,
    port: u16,
    database: &str,
) -> Result<Vec<PreservedFirmAdminCredential>, String> {
    // Use unlikely separators to avoid collisions with normal profile fields.
    let query = format!(
        r#"
SELECT concat_ws(
  chr(31),
  u."id"::text,
  u."email",
  u."fullName",
  u."preferredLanguage"::text,
  u."status"::text,
  u."passwordHash"
)
FROM public."User" u
JOIN public."Role" r ON r."id" = u."roleId"
WHERE u."deletedAt" IS NULL
  AND u."passwordHash" IS NOT NULL
  AND r."key" = {};
"#,
        sql_literal(FIRM_ADMIN_ROLE_KEY)
    );

    let raw = run_psql_capture_output(app, port, database, &query)?;
    let mut preserved = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parts = trimmed.split('\u{1f}').collect::<Vec<_>>();
        if parts.len() != 6 {
            return Err(format!(
                "Unable to parse firm admin credential snapshot row: {}",
                trimmed
            ));
        }
        preserved.push(PreservedFirmAdminCredential {
            id: parts[0].to_string(),
            email: parts[1].to_string(),
            full_name: parts[2].to_string(),
            preferred_language: parts[3].to_string(),
            status: parts[4].to_string(),
            password_hash: parts[5].to_string(),
        });
    }
    Ok(preserved)
}

fn build_reconcile_admin_credentials_sql(
    credentials: &[PreservedFirmAdminCredential],
) -> Option<String> {
    if credentials.is_empty() {
        return None;
    }

    let mut sql = String::from("BEGIN;\n");
    sql.push_str(&format!(
        r#"INSERT INTO public."Role" ("id", "key", "name", "scope", "createdAt", "updatedAt")
SELECT gen_random_uuid(), {role_key}, 'Firm Admin', 'SYSTEM', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public."Role" WHERE "firmId" IS NULL AND "key" = {role_key}
);
"#,
        role_key = sql_literal(FIRM_ADMIN_ROLE_KEY)
    ));

    sql.push_str(
        r#"
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Firm") THEN
    RAISE EXCEPTION 'Admin credential reconciliation failed: restored database has no firm record';
  END IF;
END $$;
"#,
    );

    for credential in credentials {
        let role_subquery = format!(
            "(SELECT \"id\" FROM public.\"Role\" WHERE \"firmId\" IS NULL AND \"key\" = {} LIMIT 1)",
            sql_literal(FIRM_ADMIN_ROLE_KEY)
        );
        let firm_subquery =
            "(SELECT \"id\" FROM public.\"Firm\" ORDER BY \"createdAt\" ASC LIMIT 1)";
        sql.push_str(&format!(
            r#"
UPDATE public."User"
SET "passwordHash" = {password_hash}, "updatedAt" = now()
WHERE "email" = {email}
  AND "deletedAt" IS NULL;

INSERT INTO public."User" (
  "id", "firmId", "roleId", "email", "fullName", "passwordHash", "preferredLanguage", "status", "createdAt", "updatedAt"
)
SELECT
  {id},
  {firm_id},
  {role_id},
  {email},
  {full_name},
  {password_hash},
  {preferred_language}::public."Language",
  {status}::public."UserStatus",
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public."User"
  WHERE "email" = {email}
    AND "deletedAt" IS NULL
);
"#,
            id = sql_literal(&credential.id),
            firm_id = firm_subquery,
            role_id = role_subquery,
            email = sql_literal(&credential.email),
            full_name = sql_literal(&credential.full_name),
            password_hash = sql_literal(&credential.password_hash),
            preferred_language = sql_literal(&credential.preferred_language),
            status = sql_literal(&credential.status),
        ));
    }

    sql.push_str("COMMIT;");
    Some(sql)
}

fn reconcile_admin_credentials_after_restore(
    app: &AppHandle,
    port: u16,
    database: &str,
    credentials: &[PreservedFirmAdminCredential],
) -> Result<(), String> {
    let Some(sql) = build_reconcile_admin_credentials_sql(credentials) else {
        return Ok(());
    };
    run_psql_execute_sql(app, port, database, &sql)
        .map_err(|error| format!("Admin credential reconciliation failed after restore: {error}"))
}

fn normalize_restore_sql(sql: &str) -> String {
    sql.replace(
        "'unaccent'::regdictionary",
        "'public.unaccent'::pg_catalog.regdictionary",
    )
}

fn invalidate_migration_marker(app_data: &Path) -> Result<(), String> {
    let marker_path = app_data.join(MIGRATION_VERSION_MARKER_FILE);
    if !marker_path.exists() {
        return Ok(());
    }

    fs::remove_file(&marker_path)
        .map_err(|error| format!("Unable to clear migration marker after restore failure: {error}"))
}

fn request_forced_migration_on_next_boot(app_data: &Path) -> Result<(), String> {
    let marker_path = app_data.join(FORCE_MIGRATION_MARKER_FILE);
    fs::write(&marker_path, "restore").map_err(|error| {
        format!(
            "Unable to request forced migration on next bootstrap ({}): {error}",
            marker_path.display()
        )
    })
}

fn restore_uploads_atomically(uploads_src: &Path, uploads_target: &Path) -> Result<(), String> {
    let uploads_backup = uploads_target.with_extension("pre-restore");
    if uploads_backup.exists() {
        fs::remove_dir_all(&uploads_backup).map_err(|error| {
            format!(
                "Unable to clear stale uploads rollback directory {}: {error}",
                uploads_backup.display()
            )
        })?;
    }

    let had_existing_uploads = uploads_target.exists();
    if had_existing_uploads {
        fs::rename(uploads_target, &uploads_backup).map_err(|error| {
            format!(
                "Unable to stage existing uploads directory {}: {error}",
                uploads_target.display()
            )
        })?;
    }

    let apply_result = (|| -> Result<(), String> {
        fs::create_dir_all(uploads_target).map_err(|error| {
            format!(
                "Unable to create uploads directory {}: {error}",
                uploads_target.display()
            )
        })?;
        copy_dir_recursive(uploads_src, uploads_target)?;
        Ok(())
    })();

    if let Err(error) = apply_result {
        let _ = fs::remove_dir_all(uploads_target);
        if had_existing_uploads {
            let _ = fs::rename(&uploads_backup, uploads_target);
        }
        return Err(error);
    }

    if had_existing_uploads && uploads_backup.exists() {
        fs::remove_dir_all(&uploads_backup).map_err(|error| {
            format!(
                "Unable to remove uploads rollback directory {}: {error}",
                uploads_backup.display()
            )
        })?;
    }

    Ok(())
}

fn wait_for_postgres_ready(app: &AppHandle, port: u16) -> Result<(), String> {
    let started = SystemTime::now();

    loop {
        let pg_isready = sidecar::resolve_postgres_binary(app, "pg_isready");
        let mut command = Command::new(pg_isready);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }

        apply_postgres_runtime_env(app, &mut command);

        let status = command
            .args([
                "-h",
                "127.0.0.1",
                "-p",
                &port.to_string(),
                "-U",
                "elms",
                "-t",
                "1",
            ])
            .status()
            .map_err(|error| format!("Unable to run pg_isready: {error}"))?;

        if status.success() {
            return Ok(());
        }

        if started.elapsed().unwrap_or(Duration::from_secs(0)) > Duration::from_secs(20) {
            return Err("Embedded PostgreSQL did not become ready for restore".to_string());
        }

        std::thread::sleep(Duration::from_millis(200));
    }
}

fn start_postgres_for_restore(app: &AppHandle, app_data: &Path, port: u16) -> Result<(), String> {
    let data_dir = app_data.join("postgres");
    let logs_dir = app_data.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|error| format!("Unable to create logs dir: {error}"))?;

    let pid_file = data_dir.join("postmaster.pid");
    if pid_file.exists() {
        let _ = fs::remove_file(pid_file);
    }

    let log_path = logs_dir.join("postgres-restore.log");
    let pg_ctl = sidecar::resolve_postgres_binary(app, "pg_ctl");
    let mut command = Command::new(pg_ctl);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    apply_postgres_runtime_env(app, &mut command);

    #[cfg(unix)]
    let pg_opts = {
        let socket_dir = data_dir.parent().unwrap_or(&data_dir);
        format!("-p {} -k {}", port, socket_dir.display())
    };
    #[cfg(not(unix))]
    let pg_opts = format!("-p {}", port);

    let output = command
        .args([
            "-D",
            &data_dir.to_string_lossy(),
            "-l",
            &log_path.to_string_lossy(),
            "-o",
            &pg_opts,
            "start",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Unable to start embedded PostgreSQL for restore: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("already running") {
            return Err(format!("pg_ctl start failed during restore: {stderr}"));
        }
    }

    wait_for_postgres_ready(app, port)
}

fn stop_postgres_for_restore(app: &AppHandle, app_data: &Path) -> Result<(), String> {
    let data_dir = app_data.join("postgres");
    let pg_ctl = sidecar::resolve_postgres_binary(app, "pg_ctl");
    let mut command = Command::new(pg_ctl);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    apply_postgres_runtime_env(app, &mut command);

    let output = command
        .args(["-D", &data_dir.to_string_lossy(), "-m", "fast", "stop"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Unable to stop embedded PostgreSQL after restore: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("PID file") {
            return Err(format!("pg_ctl stop failed after restore: {stderr}"));
        }
    }

    Ok(())
}

fn apply_restore_from_backup(app: &AppHandle, backup_path: &Path) -> Result<(), String> {
    let app_data = app_data_dir(app)?;
    let port = infer_postgres_port(&app_data);
    let database_name = infer_database_name(&app_data);

    let restore_work = app_data
        .join("restore-work")
        .join(format!("{}", Local::now().timestamp_millis()));
    fs::create_dir_all(&restore_work)
        .map_err(|error| format!("Unable to create restore work directory: {error}"))?;

    let cleanup = || {
        let _ = fs::remove_dir_all(&restore_work);
    };

    let preserved_admin_credentials = preserve_firm_admin_credentials(app, port, &database_name)?;
    let mut runtime_stopped = false;
    let mut restore_postgres_started = false;
    let result = (|| -> Result<(), String> {
        extract_archive(backup_path, &restore_work)?;

        let manifest_path = restore_work.join("manifest.json");
        let manifest = read_manifest(&manifest_path)?;
        if manifest.version != 1 {
            return Err(format!(
                "Unsupported backup manifest version: {}",
                manifest.version
            ));
        }

        let dump_path = restore_work.join("database.sql.gz");
        if !dump_path.exists() {
            return Err("Backup archive is missing database.sql.gz".to_string());
        }

        let sql_path = restore_work.join("database.sql");
        {
            let dump_file = File::open(&dump_path)
                .map_err(|error| format!("Unable to read backup dump: {error}"))?;
            let mut decoder = GzDecoder::new(dump_file);
            let mut sql_bytes = Vec::new();
            std::io::copy(&mut decoder, &mut sql_bytes)
                .map_err(|error| format!("Unable to decompress backup SQL dump: {error}"))?;
            let sql_raw = String::from_utf8(sql_bytes)
                .map_err(|error| format!("Backup SQL dump is not valid UTF-8: {error}"))?;
            let normalized_sql = normalize_restore_sql(&sql_raw);
            let mut sql_file = File::create(&sql_path)
                .map_err(|error| format!("Unable to create restore SQL file: {error}"))?;
            sql_file
                .write_all(normalized_sql.as_bytes())
                .map_err(|error| format!("Unable to write normalized restore SQL file: {error}"))?;
            sql_file
                .flush()
                .map_err(|error| format!("Unable to flush restore SQL file: {error}"))?;
        }

        sidecar::shutdown_runtime(app);
        runtime_stopped = true;
        std::thread::sleep(Duration::from_millis(500));

        start_postgres_for_restore(app, &app_data, port)?;
        restore_postgres_started = true;
        run_psql_restore(app, &sql_path, port, &database_name)?;
        reconcile_admin_credentials_after_restore(
            app,
            port,
            &database_name,
            &preserved_admin_credentials,
        )?;

        let uploads_src = restore_work.join("uploads");
        let uploads_target = app_data.join("uploads");
        restore_uploads_atomically(&uploads_src, &uploads_target)?;

        invalidate_migration_marker(&app_data)?;
        request_forced_migration_on_next_boot(&app_data)?;
        Ok(())
    })();

    cleanup();
    if restore_postgres_started {
        let _ = stop_postgres_for_restore(app, &app_data);
    }
    if runtime_stopped {
        if result.is_err() {
            let _ = invalidate_migration_marker(&app_data);
        }
        sidecar::start_runtime_bootstrap(app);
    }
    result
}

fn compute_next_run(
    now: chrono::DateTime<Local>,
    policy: &BackupPolicy,
) -> Option<chrono::DateTime<Local>> {
    if !policy.enabled {
        return None;
    }

    let (hour, minute) = parse_time_local(&policy.time_local).ok()?;

    let run_today = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), hour, minute, 0)
        .single()?;

    match policy.frequency {
        BackupFrequency::Daily => {
            if run_today > now {
                Some(run_today)
            } else {
                Some(run_today + chrono::Duration::days(1))
            }
        }
        BackupFrequency::Weekly => {
            let target_weekday = policy.weekly_day? as i64;
            let current_weekday = now.weekday().num_days_from_sunday() as i64;
            let mut delta_days = target_weekday - current_weekday;
            if delta_days < 0 {
                delta_days += 7;
            }

            let candidate_day = now.date_naive() + chrono::Duration::days(delta_days);
            let candidate = Local
                .with_ymd_and_hms(
                    candidate_day.year(),
                    candidate_day.month(),
                    candidate_day.day(),
                    hour,
                    minute,
                    0,
                )
                .single()?;

            if candidate > now {
                Some(candidate)
            } else {
                Some(candidate + chrono::Duration::days(7))
            }
        }
    }
}

fn should_run_schedule(policy: &BackupPolicy, last_backup_at: Option<&str>) -> bool {
    let now = Local::now();
    let reference = if let Some(last_raw) = last_backup_at {
        chrono::DateTime::parse_from_rfc3339(last_raw)
            .map(|value| value.with_timezone(&Local))
            .unwrap_or_else(|_| match policy.frequency {
                BackupFrequency::Daily => now - chrono::Duration::days(2),
                BackupFrequency::Weekly => now - chrono::Duration::days(8),
            })
    } else {
        match policy.frequency {
            BackupFrequency::Daily => now - chrono::Duration::days(2),
            BackupFrequency::Weekly => now - chrono::Duration::days(8),
        }
    };

    let Some(next_due) = compute_next_run(reference, policy) else {
        return false;
    };
    next_due <= now
}

fn build_policy_response(app: &AppHandle) -> Result<BackupPolicyResponse, String> {
    let stored = load_stored_policy(app)?;
    let backup_dir = effective_backup_directory(app, &stored)?;
    fs::create_dir_all(&backup_dir).map_err(|error| {
        format!(
            "Unable to create backup directory {}: {error}",
            backup_dir.display()
        )
    })?;

    let next_scheduled_backup_at =
        compute_next_run(Local::now(), &stored.policy).map(|dt| dt.to_rfc3339());

    Ok(BackupPolicyResponse {
        policy: stored.policy,
        effective_backup_directory: backup_dir.to_string_lossy().into_owned(),
        configured_backup_directory: stored.backup_directory,
        backups: list_backups_in_dir(&backup_dir)?,
        last_backup_at: stored.last_backup_at,
        last_backup_result: stored.last_backup_result,
        last_backup_path: stored.last_backup_path,
        next_scheduled_backup_at,
    })
}

#[tauri::command]
pub fn desktop_get_backup_policy(app: AppHandle) -> Result<BackupPolicyResponse, String> {
    build_policy_response(&app)
}

#[tauri::command]
pub fn desktop_set_backup_policy(
    app: AppHandle,
    payload: SetBackupPolicyInput,
) -> Result<BackupPolicyResponse, String> {
    let mut stored = load_stored_policy(&app)?;
    let updated = BackupPolicy {
        enabled: payload.enabled,
        frequency: payload.frequency,
        time_local: payload.time_local,
        weekly_day: payload.weekly_day,
        retention_count: payload.retention_count,
    };

    validate_policy(&updated)?;
    stored.policy = updated;
    save_stored_policy(&app, &stored)?;
    build_policy_response(&app)
}

#[tauri::command]
pub fn desktop_choose_backup_directory(app: AppHandle) -> Result<BackupPolicyResponse, String> {
    let maybe_path = app
        .dialog()
        .file()
        .set_title("Choose Backup Folder")
        .blocking_pick_folder();

    let mut stored = load_stored_policy(&app)?;
    if let Some(path) = maybe_path {
        let selected = path
            .into_path()
            .map_err(|_| "Selected backup directory is invalid".to_string())?;
        stored.backup_directory = Some(selected.to_string_lossy().into_owned());
        save_stored_policy(&app, &stored)?;
    }

    build_policy_response(&app)
}

#[tauri::command]
pub fn desktop_reset_backup_directory(app: AppHandle) -> Result<BackupPolicyResponse, String> {
    let mut stored = load_stored_policy(&app)?;
    stored.backup_directory = None;
    save_stored_policy(&app, &stored)?;
    build_policy_response(&app)
}

#[tauri::command]
pub fn desktop_list_backups(app: AppHandle) -> Result<Vec<BackupFileItem>, String> {
    let stored = load_stored_policy(&app)?;
    let backup_dir = effective_backup_directory(&app, &stored)?;
    list_backups_in_dir(&backup_dir)
}

#[tauri::command]
pub fn desktop_run_backup_now(
    app: AppHandle,
    backup_state: State<'_, BackupState>,
    runtime_state: State<'_, sidecar::RuntimeState>,
) -> Result<BackupOperationResult, String> {
    if runtime_state.is_bootstrapping() || runtime_state.current_phase() != "ready" {
        return Err("Desktop runtime is not ready for backup".to_string());
    }

    let _guard = begin_operation(&backup_state)?;
    let path = run_backup_internal(&app, BackupTrigger::Manual, None)?;
    Ok(BackupOperationResult {
        ok: true,
        message: "Backup completed".to_string(),
        backup_path: Some(path.to_string_lossy().into_owned()),
    })
}

#[tauri::command]
pub fn desktop_restore_backup(
    app: AppHandle,
    payload: RestoreBackupInput,
    backup_state: State<'_, BackupState>,
    runtime_state: State<'_, sidecar::RuntimeState>,
) -> Result<BackupOperationResult, String> {
    if runtime_state.is_bootstrapping() {
        return Err("Desktop runtime is still bootstrapping".to_string());
    }

    let backup_path = PathBuf::from(payload.backup_path);
    if !backup_path.exists() {
        return Err(format!("Backup file not found: {}", backup_path.display()));
    }
    let backup_path = fs::canonicalize(&backup_path).map_err(|error| {
        format!(
            "Unable to resolve backup path {}: {error}",
            backup_path.display()
        )
    })?;

    let _guard = begin_operation(&backup_state)?;
    runtime_state.set_phase_with_message(
        "recovering",
        Some("Restore applied, restarting desktop services.".to_string()),
    );

    // Safety backup before destructive restore.
    run_backup_internal(&app, BackupTrigger::PreRestore, Some(&backup_path))?;
    if !backup_path.exists() {
        return Err(format!(
            "Backup file was removed before restore could start: {}",
            backup_path.display()
        ));
    }
    apply_restore_from_backup(&app, &backup_path)?;

    Ok(BackupOperationResult {
        ok: true,
        message: "Restore started. Desktop services are restarting.".to_string(),
        backup_path: None,
    })
}

pub fn start_backup_scheduler(app: AppHandle) {
    let state = app.state::<BackupState>();
    if state
        .scheduler_started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));

        let runtime_state = app.state::<sidecar::RuntimeState>();
        if runtime_state.is_bootstrapping() || runtime_state.current_phase() != "ready" {
            continue;
        }

        let stored = match load_stored_policy(&app) {
            Ok(value) => value,
            Err(_) => continue,
        };

        if !should_run_schedule(&stored.policy, stored.last_backup_at.as_deref()) {
            continue;
        }

        let backup_state = app.state::<BackupState>();
        let guard = match begin_operation(&backup_state) {
            Ok(guard) => guard,
            Err(_) => continue,
        };

        let _ = run_backup_internal(&app, BackupTrigger::Scheduled, None);
        drop(guard);
    });
}

#[cfg(test)]
mod tests {
    use super::{
        build_psql_restore_args, build_reconcile_admin_credentials_sql, compute_next_run,
        extract_archive, invalidate_migration_marker, is_disallowed_archive_entry_type,
        normalize_restore_sql, parse_time_local, prune_backups,
        request_forced_migration_on_next_boot, restore_uploads_atomically,
        validate_archive_relative_path, BackupFrequency, BackupPolicy,
        PreservedFirmAdminCredential, FORCE_MIGRATION_MARKER_FILE, MIGRATION_VERSION_MARKER_FILE,
    };
    use chrono::{Datelike, Local, TimeZone, Timelike};
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::fs;
    use std::fs::File;
    use std::path::{Path, PathBuf};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!("elms-desktop-backup-{label}-{nanos}"));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    fn write_archive(backup_file: &Path, entries: Vec<(PathBuf, tar::EntryType, Vec<u8>)>) {
        let file = File::create(backup_file).expect("create archive file");
        let encoder = GzEncoder::new(file, Compression::default());
        let mut builder = tar::Builder::new(encoder);

        for (path, entry_type, data) in entries {
            let mut header = tar::Header::new_gnu();
            header.set_mode(0o644);
            header.set_mtime(0);
            header.set_entry_type(entry_type);
            header.set_size(data.len() as u64);
            header.set_cksum();
            builder
                .append_data(&mut header, path, data.as_slice())
                .expect("append entry");
        }

        builder.finish().expect("finish archive");
    }

    #[test]
    fn validates_time_local_format() {
        assert!(parse_time_local("02:00").is_ok());
        assert!(parse_time_local("23:59").is_ok());
        assert!(parse_time_local("24:00").is_err());
        assert!(parse_time_local("aa:00").is_err());
    }

    #[test]
    fn computes_next_daily_run() {
        let now = Local
            .with_ymd_and_hms(2026, 4, 12, 1, 0, 0)
            .single()
            .expect("valid date");
        let policy = BackupPolicy {
            enabled: true,
            frequency: BackupFrequency::Daily,
            time_local: "02:00".to_string(),
            weekly_day: None,
            retention_count: 14,
        };

        let next = compute_next_run(now, &policy).expect("next run");
        assert_eq!(next.hour(), 2);
        assert_eq!(next.minute(), 0);
    }

    #[test]
    fn computes_next_weekly_run() {
        let now = Local
            .with_ymd_and_hms(2026, 4, 12, 9, 0, 0)
            .single()
            .expect("valid date"); // Sunday
        let policy = BackupPolicy {
            enabled: true,
            frequency: BackupFrequency::Weekly,
            time_local: "08:00".to_string(),
            weekly_day: Some(0),
            retention_count: 14,
        };

        let next = compute_next_run(now, &policy).expect("next run");
        // same weekday, but next week because target time already passed
        assert_eq!(next.weekday().num_days_from_sunday(), 0);
        assert!((next.date_naive() - now.date_naive()).num_days() >= 7);
    }

    #[test]
    fn validates_archive_paths() {
        assert_eq!(
            validate_archive_relative_path(Path::new("manifest.json"))
                .expect("manifest path should be valid"),
            PathBuf::from("manifest.json")
        );
        assert_eq!(
            validate_archive_relative_path(Path::new("uploads/cases/doc.pdf"))
                .expect("uploads path should be valid"),
            PathBuf::from("uploads/cases/doc.pdf")
        );
        assert!(validate_archive_relative_path(Path::new("/etc/passwd")).is_err());
        assert!(validate_archive_relative_path(Path::new("../outside")).is_err());
        assert!(validate_archive_relative_path(Path::new("uploads/../../outside")).is_err());
        assert!(validate_archive_relative_path(Path::new("notes.txt")).is_err());
    }

    #[test]
    fn rejects_symlink_and_hardlink_archive_entries() {
        assert!(is_disallowed_archive_entry_type(tar::EntryType::Symlink));
        assert!(is_disallowed_archive_entry_type(tar::EntryType::Link));
    }

    #[test]
    fn rejects_invalid_archive_without_extracting_files() {
        let root = unique_temp_dir("invalid-archive");
        let backup_file = root.join("invalid.elmsbk");
        let destination = root.join("restore");
        fs::create_dir_all(&destination).expect("create restore dir");

        write_archive(
            &backup_file,
            vec![(
                PathBuf::from("evil.txt"),
                tar::EntryType::Regular,
                b"unsafe".to_vec(),
            )],
        );

        let result = extract_archive(&backup_file, &destination);
        assert!(result.is_err());
        assert!(!destination.join("evil.txt").exists());

        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn normalizes_legacy_unaccent_dictionary_cast_in_restore_sql() {
        let raw = "SELECT public.unaccent('unaccent'::regdictionary, $1);";
        let normalized = normalize_restore_sql(raw);
        assert!(normalized.contains("'public.unaccent'::pg_catalog.regdictionary"));
        assert!(!normalized.contains("'unaccent'::regdictionary"));
    }

    #[test]
    fn keeps_non_matching_restore_sql_unchanged() {
        let raw = "SELECT lower(title) FROM public.\"Document\";";
        assert_eq!(normalize_restore_sql(raw), raw);
    }

    #[test]
    fn psql_restore_args_enable_single_transaction_and_on_error_stop() {
        let args =
            build_psql_restore_args(Path::new("/tmp/restore.sql"), 15433, "elms_desktop_dev");
        assert!(args.contains(&"--single-transaction".to_string()));
        assert!(args.contains(&"ON_ERROR_STOP=1".to_string()));
    }

    #[test]
    fn invalidates_migration_marker_file() {
        let root = unique_temp_dir("migration-marker");
        let marker_path = root.join(MIGRATION_VERSION_MARKER_FILE);
        fs::write(&marker_path, "0034_case_session_follow_up_link").expect("seed marker");

        invalidate_migration_marker(&root).expect("invalidate marker");
        assert!(!marker_path.exists());

        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn requests_forced_migration_marker_file() {
        let root = unique_temp_dir("force-migration-marker");
        let marker_path = root.join(FORCE_MIGRATION_MARKER_FILE);

        request_forced_migration_on_next_boot(&root).expect("write forced marker");
        assert!(
            marker_path.exists(),
            "forced migration marker should be created"
        );

        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn prune_backups_keeps_preserved_restore_source() {
        let root = unique_temp_dir("prune-preserve");
        let old_backup = root.join("elms-backup-20260101T000000.elmsbk");
        let keep_backup = root.join("elms-backup-20260102T000000.elmsbk");
        fs::write(&old_backup, b"old").expect("write old backup");
        fs::write(&keep_backup, b"keep").expect("write keep backup");

        std::thread::sleep(Duration::from_millis(10));
        // Touch preserve target last so normal pruning would keep this newest file anyway,
        // then assert preserve argument also works when file is beyond retention cut.
        fs::write(&keep_backup, b"keep-new").expect("refresh keep backup");

        prune_backups(&root, 0, Some(&old_backup)).expect("prune backups");

        assert!(
            old_backup.exists(),
            "preserved backup should not be deleted"
        );
        assert!(
            !keep_backup.exists(),
            "non-preserved backup should be pruned"
        );
        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn restore_uploads_atomically_treats_missing_source_as_empty_snapshot() {
        let root = unique_temp_dir("uploads-empty-snapshot");
        let uploads_target = root.join("uploads");
        fs::create_dir_all(&uploads_target).expect("create uploads target");
        let original_file = uploads_target.join("original.txt");
        fs::write(&original_file, b"original").expect("seed original upload");

        let missing_source = root.join("missing-uploads-source");
        restore_uploads_atomically(&missing_source, &uploads_target)
            .expect("missing uploads source should produce empty uploads");
        assert!(
            !uploads_target.join("original.txt").exists(),
            "original uploads should be removed when archive has no uploads directory"
        );
        assert!(
            !uploads_target.with_extension("pre-restore").exists(),
            "rollback temp directory should not remain after restore success"
        );

        fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn reconcile_admin_credentials_sql_is_none_when_no_credentials() {
        assert!(build_reconcile_admin_credentials_sql(&[]).is_none());
    }

    #[test]
    fn reconcile_admin_credentials_sql_updates_and_inserts_with_transaction() {
        let sql = build_reconcile_admin_credentials_sql(&[PreservedFirmAdminCredential {
            id: "admin-id".to_string(),
            email: "admin@firm.local".to_string(),
            full_name: "Admin User".to_string(),
            preferred_language: "AR".to_string(),
            status: "ACTIVE".to_string(),
            password_hash: "hash-1".to_string(),
        }])
        .expect("sql should be generated");

        assert!(sql.contains("BEGIN;"));
        assert!(sql.contains("COMMIT;"));
        assert!(sql.contains("INSERT INTO public.\"Role\""));
        assert!(sql.contains("UPDATE public.\"User\""));
        assert!(sql.contains("INSERT INTO public.\"User\""));
        assert!(sql.contains("'firm_admin'"));
        assert!(sql.contains("'admin@firm.local'"));
        assert!(sql.contains("WHERE \"email\" = 'admin@firm.local'"));
        assert!(
            !sql.contains("AND \"firmId\" = 'firm-id'"),
            "reconciliation should not match by firmId"
        );
        assert!(
            sql.contains("(SELECT \"id\" FROM public.\"Firm\" ORDER BY \"createdAt\" ASC LIMIT 1)")
        );
        assert!(sql.contains(
            "Admin credential reconciliation failed: restored database has no firm record"
        ));
    }

    #[test]
    fn reconcile_admin_credentials_sql_avoids_firm_id_based_duplicate_insert_path() {
        let sql = build_reconcile_admin_credentials_sql(&[PreservedFirmAdminCredential {
            id: "old-admin-id".to_string(),
            email: "admin@elms.local".to_string(),
            full_name: "Legacy Admin".to_string(),
            preferred_language: "AR".to_string(),
            status: "ACTIVE".to_string(),
            password_hash: "preserved-hash".to_string(),
        }])
        .expect("sql should be generated");

        assert!(
            sql.contains("WHERE \"email\" = 'admin@elms.local'\n  AND \"deletedAt\" IS NULL;"),
            "update path must target active user by email only"
        );
        assert!(
            sql.contains("WHERE \"email\" = 'admin@elms.local'\n    AND \"deletedAt\" IS NULL"),
            "insert guard must use email-only active check"
        );
        assert!(
            !sql.contains("\"firmId\" = 'legacy-firm-id'"),
            "legacy firmId should not participate in match/guard predicates"
        );
    }
}
