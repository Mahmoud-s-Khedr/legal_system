import type { TFunction } from "i18next";

export function formatFileSaveSuccessMessage(
  t: TFunction<"app", undefined>,
  savedPath?: string | null
) {
  const path = savedPath?.trim();
  if (path) {
    return t("messages.fileSavedTo", { path });
  }

  return t("messages.fileDownloadStarted");
}

export function formatFileSaveFailureMessage(
  t: TFunction<"app", undefined>
) {
  return t("messages.fileSaveFailed");
}

export function formatDesktopBackupSuccessMessage(
  t: TFunction<"app", undefined>,
  result: { message?: string | null; backupPath?: string | null } | null
) {
  const message = result?.message?.trim();
  const path = result?.backupPath?.trim();

  if (message && path) {
    return `${message} ${t("messages.fileSavedTo", { path })}`;
  }

  if (message) {
    return message;
  }

  if (path) {
    return t("messages.fileSavedTo", { path });
  }

  return t("messages.backupCompleted");
}
