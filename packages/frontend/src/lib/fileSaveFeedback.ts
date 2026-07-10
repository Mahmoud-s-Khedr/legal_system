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
