const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";

type BackupFrequency = "daily" | "weekly";

export interface DesktopBackupPolicy {
  enabled: boolean;
  frequency: BackupFrequency;
  timeLocal: string;
  weeklyDay: number | null;
  retentionCount: number;
}

export interface DesktopBackupFile {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedAt?: string;
}

export interface DesktopBackupPolicyResponse {
  policy: DesktopBackupPolicy;
  effectiveBackupDirectory: string;
  configuredBackupDirectory: string | null;
  backups: DesktopBackupFile[];
  lastBackupAt?: string;
  lastBackupResult?: string;
  lastBackupPath?: string;
  nextScheduledBackupAt?: string;
}

interface DesktopBackupOperationResult {
  ok: boolean;
  message: string;
  backupPath?: string | null;
}

interface DesktopSetBackupPolicyInput {
  enabled: boolean;
  frequency: BackupFrequency;
  timeLocal: string;
  weeklyDay?: number;
  retentionCount: number;
}

function mapDesktopBackupError(message: string) {
  switch (message) {
    case "Desktop runtime is not ready for backup":
      return "Desktop runtime is still starting. Try again in a moment.";
    case "Another backup/restore operation is already running":
      return "Another backup or restore operation is in progress.";
    default:
      return message || "Backup operation failed.";
  }
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function isDesktopBackupEnabled() {
  return isDesktopShell;
}

export function validateBackupTimeLocal(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

export function canSubmitRestoreAcknowledgement(a: boolean, b: boolean) {
  return a && b;
}

export async function getDesktopBackupPolicy(): Promise<DesktopBackupPolicyResponse | null> {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return await invokeDesktop<DesktopBackupPolicyResponse>("desktop_get_backup_policy");
  } catch (error) {
    throw new Error(mapDesktopBackupError(String(error)));
  }
}

export async function setDesktopBackupPolicy(policy: DesktopBackupPolicy): Promise<DesktopBackupPolicyResponse | null> {
  if (!isDesktopShell) {
    return null;
  }

  const payload: DesktopSetBackupPolicyInput = {
    enabled: policy.enabled,
    frequency: policy.frequency,
    timeLocal: policy.timeLocal.trim(),
    retentionCount: policy.retentionCount,
    ...(policy.frequency === "weekly" && policy.weeklyDay !== null ? { weeklyDay: policy.weeklyDay } : {})
  };

  try {
    return await invokeDesktop<DesktopBackupPolicyResponse>("desktop_set_backup_policy", { payload });
  } catch (error) {
    throw new Error(mapDesktopBackupError(String(error)));
  }
}

export async function chooseDesktopBackupDirectory(): Promise<DesktopBackupPolicyResponse | null> {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return await invokeDesktop<DesktopBackupPolicyResponse>("desktop_choose_backup_directory");
  } catch (error) {
    throw new Error(mapDesktopBackupError(String(error)));
  }
}

export async function resetDesktopBackupDirectory(): Promise<DesktopBackupPolicyResponse | null> {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return await invokeDesktop<DesktopBackupPolicyResponse>("desktop_reset_backup_directory");
  } catch (error) {
    throw new Error(mapDesktopBackupError(String(error)));
  }
}

export async function runDesktopBackupNow(): Promise<DesktopBackupOperationResult | null> {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return await invokeDesktop<DesktopBackupOperationResult>("desktop_run_backup_now");
  } catch (error) {
    throw new Error(mapDesktopBackupError(String(error)));
  }
}

export async function restoreDesktopBackup(backupPath: string): Promise<DesktopBackupOperationResult | null> {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return await invokeDesktop<DesktopBackupOperationResult>("desktop_restore_backup", {
      payload: { backupPath }
    });
  } catch (error) {
    throw new Error(mapDesktopBackupError(String(error)));
  }
}
