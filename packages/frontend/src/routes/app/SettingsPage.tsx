import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EditionKey,
  Language,
  type ActivateLicenseDto,
  type ChangeOwnPasswordDto,
  type FirmMeResponseDto,
  type LicenseActivationResponseDto,
  type RequestEditionChangeDto,
  type UpdateUserDto,
  type UserDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import {
  chooseDesktopBackupDirectory,
  getDesktopBackupPolicy,
  isDesktopBackupEnabled,
  resetDesktopBackupDirectory,
  restoreDesktopBackup,
  runDesktopBackupNow,
  setDesktopBackupPolicy,
  validateBackupTimeLocal,
  canSubmitRestoreAcknowledgement,
  type DesktopBackupPolicy
} from "../../lib/desktopBackup";
import {
  chooseDesktopDownloadDirectory,
  getDesktopDownloadSettings,
  isDesktopDownloadsEnabled,
  resetDesktopDownloadDirectory
} from "../../lib/desktopDownloads";
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import {
  Badge,
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField,
  formatDate
} from "./ui";

export function getSelectableEditionKeys() {
  return [
    EditionKey.SOLO_OFFLINE,
    EditionKey.SOLO_ONLINE,
    EditionKey.LOCAL_FIRM_OFFLINE,
    EditionKey.LOCAL_FIRM_ONLINE
  ];
}

export function getTrialDaysRemaining(
  trialEnabled: boolean,
  trialEndsAt: string | null | undefined,
  now: Date = new Date()
) {
  if (!trialEnabled || !trialEndsAt) {
    return null;
  }

  const trialEndsAtDate = new Date(trialEndsAt);
  if (Number.isNaN(trialEndsAtDate.getTime())) {
    return null;
  }

  const millisPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trialEndDay = new Date(
    trialEndsAtDate.getFullYear(),
    trialEndsAtDate.getMonth(),
    trialEndsAtDate.getDate()
  );

  return Math.max(
    0,
    Math.ceil((trialEndDay.getTime() - startOfToday.getTime()) / millisPerDay)
  );
}

export function isDesktopBackupPolicyValid(policy: DesktopBackupPolicy) {
  return (
    validateBackupTimeLocal(policy.timeLocal) &&
    policy.retentionCount >= 1 &&
    policy.retentionCount <= 365 &&
    (policy.frequency !== "weekly" || policy.weeklyDay !== null)
  );
}

export function groupPermissionsByResource(permissions: string[]) {
  return permissions.reduce<Record<string, string[]>>((acc, perm) => {
    const resource = perm.split(":")[0] ?? perm;
    (acc[resource] ??= []).push(perm);
    return acc;
  }, {});
}

export function SettingsPage() {
  const { t } = useTranslation("app");
  const isDesktopShell = isDesktopDownloadsEnabled();
  const isDesktopBackupShell = isDesktopBackupEnabled();
  const { user, refreshSession } = useAuthBootstrap();
  const canUpdateSettings =
    user?.permissions.includes("settings:update") ?? false;
  const queryClient = useQueryClient();
  const firmQuery = useQuery({
    queryKey: ["firm-me"],
    queryFn: () => apiFetch<FirmMeResponseDto>("/api/firms/me")
  });
  const selfQuery = useQuery({
    queryKey: ["user", user?.id],
    queryFn: () => apiFetch<UserDto>(`/api/users/${user?.id}`),
    enabled: Boolean(user?.id)
  });
  const desktopDownloadSettingsQuery = useQuery({
    queryKey: ["desktop-download-settings"],
    queryFn: () => getDesktopDownloadSettings(),
    enabled: isDesktopShell
  });
  const desktopBackupPolicyQuery = useQuery({
    queryKey: ["desktop-backup-policy"],
    queryFn: () => getDesktopBackupPolicy(),
    enabled: isDesktopBackupShell
  });

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    preferredLanguage: Language.AR
  });
  const [passwordForm, setPasswordForm] = useState<ChangeOwnPasswordDto>({
    currentPassword: "",
    newPassword: ""
  });
  const [activationKey, setActivationKey] = useState("");
  const [editionChangeTarget, setEditionChangeTarget] = useState<EditionKey>(
    EditionKey.SOLO_OFFLINE
  );
  const [backupPolicyForm, setBackupPolicyForm] = useState<DesktopBackupPolicy>(
    {
      enabled: true,
      frequency: "daily",
      timeLocal: "02:00",
      weeklyDay: null,
      retentionCount: 14
    }
  );
  const [selectedBackupPath, setSelectedBackupPath] = useState("");
  const [restoreCheckOne, setRestoreCheckOne] = useState(false);
  const [restoreCheckTwo, setRestoreCheckTwo] = useState(false);

  useEffect(() => {
    if (!selfQuery.data) {
      return;
    }

    setProfileForm({
      fullName: selfQuery.data.fullName,
      email: selfQuery.data.email,
      preferredLanguage: selfQuery.data.preferredLanguage as Language
    });
  }, [selfQuery.data]);

  useEffect(() => {
    const target =
      firmQuery.data?.firm.pendingEditionKey ?? firmQuery.data?.firm.editionKey;
    if (!target || target === EditionKey.ENTERPRISE) {
      return;
    }
    setEditionChangeTarget(target);
  }, [firmQuery.data?.firm.editionKey, firmQuery.data?.firm.pendingEditionKey]);

  useEffect(() => {
    const backupPolicyData = desktopBackupPolicyQuery.data;
    if (!backupPolicyData) {
      return;
    }

    setBackupPolicyForm(backupPolicyData.policy);
    setSelectedBackupPath((current) => {
      if (
        current &&
        backupPolicyData.backups.some((backup) => backup.path === current)
      ) {
        return current;
      }
      return backupPolicyData.backups[0]?.path ?? "";
    });
  }, [desktopBackupPolicyQuery.data]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload: UpdateUserDto) =>
      apiFetch<UserDto>(`/api/users/${user?.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user", user?.id] });
      await refreshSession();
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: ChangeOwnPasswordDto) =>
      apiFetch<{ success: true }>("/api/users/me/password", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setPasswordForm({
        currentPassword: "",
        newPassword: ""
      });
    }
  });
  const chooseDownloadDirectoryMutation = useMutation({
    mutationFn: () => chooseDesktopDownloadDirectory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["desktop-download-settings"]
      });
    }
  });
  const resetDownloadDirectoryMutation = useMutation({
    mutationFn: () => resetDesktopDownloadDirectory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["desktop-download-settings"]
      });
    }
  });
  const chooseBackupDirectoryMutation = useMutation({
    mutationFn: () => chooseDesktopBackupDirectory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["desktop-backup-policy"]
      });
    }
  });
  const resetBackupDirectoryMutation = useMutation({
    mutationFn: () => resetDesktopBackupDirectory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["desktop-backup-policy"]
      });
    }
  });
  const saveBackupPolicyMutation = useMutation({
    mutationFn: (payload: DesktopBackupPolicy) =>
      setDesktopBackupPolicy(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["desktop-backup-policy"]
      });
    }
  });
  const runBackupNowMutation = useMutation({
    mutationFn: () => runDesktopBackupNow(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["desktop-backup-policy"]
      });
    }
  });
  const restoreBackupMutation = useMutation({
    mutationFn: (backupPath: string) => restoreDesktopBackup(backupPath),
    onSuccess: async () => {
      setRestoreCheckOne(false);
      setRestoreCheckTwo(false);
      await queryClient.invalidateQueries({
        queryKey: ["desktop-backup-policy"]
      });
    }
  });
  const activateLicenseMutation = useMutation({
    mutationFn: (payload: ActivateLicenseDto) =>
      apiFetch<LicenseActivationResponseDto>("/api/licenses/activate", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setActivationKey("");
      await queryClient.invalidateQueries({ queryKey: ["firm-me"] });
      await refreshSession();
    }
  });
  const editionChangeMutation = useMutation({
    mutationFn: (payload: RequestEditionChangeDto) =>
      apiFetch("/api/firms/me/edition-change-request", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["firm-me"] });
      await refreshSession();
    }
  });

  if (!firmQuery.data || !user) {
    return (
      <EmptyState
        title={t("empty.noSettings")}
        description={t("empty.noSettingsHelp")}
      />
    );
  }

  const firm = firmQuery.data.firm;
  const canSelfServeLicense = firm.editionKey !== EditionKey.ENTERPRISE;
  const selectableEditions = getSelectableEditionKeys();
  const trialDaysRemaining = getTrialDaysRemaining(
    firm.trialEnabled,
    firm.trialEndsAt
  );
  const trialCountdownText = (() => {
    if (trialDaysRemaining === null || !firm.trialEndsAt) {
      return null;
    }
    return t("settings.trialActiveWithCountdown", {
      count: trialDaysRemaining,
      endDate: formatDate(firm.trialEndsAt)
    });
  })();
  const isBackupPolicyValid = isDesktopBackupPolicyValid(backupPolicyForm);
  const canSubmitRestore = canSubmitRestoreAcknowledgement(
    restoreCheckOne,
    restoreCheckTwo
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          title={t("settings.firm")}
          description={t("settings.firmHelp")}
        >
          <dl className="space-y-3 text-sm">
            <Detail label={t("labels.name")} value={firm.name} />
            <Detail label={t("labels.slug")} value={firm.slug} />
            <Detail
              label={t("labels.type")}
              value={getEnumLabel(t, "FirmType", firm.type)}
            />
            <Detail
              label={t("labels.language")}
              value={getEnumLabel(t, "Language", firm.defaultLanguage)}
            />
            <Detail label={t("settings.firmId")} value={firm.id} />
            <Detail
              label={t("settings.edition")}
              value={firm.pendingEditionKey ?? firm.editionKey}
            />
            {firm.pendingEditionKey ? (
              <Detail
                label={t("settings.pendingEdition")}
                value={firm.pendingEditionKey}
              />
            ) : null}
          </dl>
        </SectionCard>
        <SectionCard
          title={t("settings.session")}
          description={t("settings.sessionHelp")}
        >
          <dl className="space-y-3 text-sm">
            <Detail label={t("labels.fullName")} value={user.fullName} />
            <Detail label={t("labels.email")} value={user.email} />
            <Detail
              label={t("labels.role")}
              value={getEnumLabel(t, "UserRole", user.roleKey)}
            />
            <Detail
              label={t("labels.language")}
              value={getEnumLabel(t, "Language", user.preferredLanguage)}
            />
          </dl>
        </SectionCard>
        <SectionCard
          title={t("settings.permissions")}
          description={t("settings.permissionsHelp")}
        >
          <div className="space-y-4">
            {Object.entries(
              groupPermissionsByResource(user.permissions)
            ).map(([resource, perms]) => (
              <div key={resource}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide rtl:tracking-normal text-slate-500">
                  {resource}
                </p>
                <div className="flex flex-wrap gap-2">
                  {perms.map((perm) => (
                    <Badge key={perm}>{perm.split(":")[1] ?? perm}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <SectionCard
        title={t("settings.licensingTitle")}
        description={t("settings.licensingHelp")}
      >
        <div className="space-y-4">
          {firm.licenseRequired ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("settings.licenseRequiredWarning")}
            </p>
          ) : firm.isLicensed ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {t("settings.licenseActive")}
            </p>
          ) : firm.trialEnabled ? (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              {trialCountdownText ?? t("settings.trialActive")}
            </p>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {t("settings.licenseUnknown")}
            </p>
          )}
          {canSelfServeLicense ? (
            <>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!activationKey.trim()) return;
                  activateLicenseMutation.mutate({
                    activationKey: activationKey.trim()
                  });
                }}
              >
                <Field
                  id="activation-key"
                  label={t("settings.activationKey")}
                  onChange={setActivationKey}
                  value={activationKey}
                />
                <PrimaryButton type="submit">
                  {t("settings.activateLicense")}
                </PrimaryButton>
                {activateLicenseMutation.error ? (
                  <p className="text-sm text-red-600">
                    {(activateLicenseMutation.error as Error).message}
                  </p>
                ) : null}
              </form>
              <form
                className="space-y-3 border-t border-slate-200 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  editionChangeMutation.mutate({
                    editionKey: editionChangeTarget
                  });
                }}
              >
                <SelectField
                  id="edition-change-target"
                  label={t("settings.changeEdition")}
                  onChange={(value) =>
                    setEditionChangeTarget(value as EditionKey)
                  }
                  options={selectableEditions.map((value) => ({
                    value,
                    label: value
                  }))}
                  value={editionChangeTarget}
                />
                <PrimaryButton type="submit">
                  {t("settings.requestEditionChange")}
                </PrimaryButton>
                {editionChangeMutation.error ? (
                  <p className="text-sm text-red-600">
                    {(editionChangeMutation.error as Error).message}
                  </p>
                ) : null}
              </form>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {t("settings.enterpriseContractOnly")}
            </p>
          )}
        </div>
      </SectionCard>
      <SectionCard
        title={t("notifications.preferences")}
        description={t("notifications.preferencesDescription")}
      >
        <Link
          className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition"
          to="/app/settings/notifications"
        >
          {t("notifications.channelSettings")}
        </Link>
      </SectionCard>
      {isDesktopShell ? (
        <SectionCard
          title={t("settings.downloadsTitle")}
          description={t("settings.downloadsHelp")}
        >
          <div className="space-y-3">
            <Detail
              label={t("settings.downloadsCurrent")}
              value={
                desktopDownloadSettingsQuery.data?.effectivePath ??
                t("labels.loading")
              }
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={
                  chooseDownloadDirectoryMutation.isPending ||
                  resetDownloadDirectoryMutation.isPending
                }
                onClick={() => {
                  void chooseDownloadDirectoryMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.chooseDownloadFolder")}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={
                  chooseDownloadDirectoryMutation.isPending ||
                  resetDownloadDirectoryMutation.isPending
                }
                onClick={() => {
                  void resetDownloadDirectoryMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.resetDownloadFolder")}
              </button>
            </div>
            {chooseDownloadDirectoryMutation.error ? (
              <p className="text-sm text-red-600">
                {(chooseDownloadDirectoryMutation.error as Error).message}
              </p>
            ) : null}
            {resetDownloadDirectoryMutation.error ? (
              <p className="text-sm text-red-600">
                {(resetDownloadDirectoryMutation.error as Error).message}
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
      {isDesktopBackupShell ? (
        <SectionCard
          title={t("settings.backupTitle")}
          description={t("settings.backupHelp")}
        >
          <div className="space-y-4">
            <Detail
              label={t("settings.backupDirectory")}
              value={
                desktopBackupPolicyQuery.data?.effectiveBackupDirectory ??
                t("labels.loading")
              }
            />
            <div className="grid gap-3 xl:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-slate-600">
                  {t("settings.backupEnabled")}
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                  disabled={!canUpdateSettings}
                  onChange={(event) =>
                    setBackupPolicyForm((current) => ({
                      ...current,
                      enabled: event.target.value === "true"
                    }))
                  }
                  value={String(backupPolicyForm.enabled)}
                >
                  <option value="true">{t("settings.backupOn")}</option>
                  <option value="false">{t("settings.backupOff")}</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-600">
                  {t("settings.backupFrequency")}
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                  disabled={!canUpdateSettings}
                  onChange={(event) =>
                    setBackupPolicyForm((current) => ({
                      ...current,
                      frequency: event.target.value as "daily" | "weekly",
                      weeklyDay:
                        event.target.value === "weekly"
                          ? (current.weeklyDay ?? 0)
                          : null
                    }))
                  }
                  value={backupPolicyForm.frequency}
                >
                  <option value="daily">{t("settings.backupDaily")}</option>
                  <option value="weekly">{t("settings.backupWeekly")}</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-600">
                  {t("settings.backupTime")}
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                  disabled={!canUpdateSettings}
                  onChange={(event) =>
                    setBackupPolicyForm((current) => ({
                      ...current,
                      timeLocal: event.target.value
                    }))
                  }
                  type="time"
                  value={backupPolicyForm.timeLocal}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-600">
                  {t("settings.backupRetention")}
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                  disabled={!canUpdateSettings}
                  max={365}
                  min={1}
                  onChange={(event) =>
                    setBackupPolicyForm((current) => ({
                      ...current,
                      retentionCount: Number(event.target.value || 1)
                    }))
                  }
                  type="number"
                  value={backupPolicyForm.retentionCount}
                />
              </label>
              {backupPolicyForm.frequency === "weekly" ? (
                <label className="space-y-2 text-sm">
                  <span className="text-slate-600">
                    {t("settings.backupWeekday")}
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                    disabled={!canUpdateSettings}
                    onChange={(event) =>
                      setBackupPolicyForm((current) => ({
                        ...current,
                        weeklyDay: Number(event.target.value)
                      }))
                    }
                    value={backupPolicyForm.weeklyDay ?? 0}
                  >
                    <option value={0}>{t("settings.daySunday")}</option>
                    <option value={1}>{t("settings.dayMonday")}</option>
                    <option value={2}>{t("settings.dayTuesday")}</option>
                    <option value={3}>{t("settings.dayWednesday")}</option>
                    <option value={4}>{t("settings.dayThursday")}</option>
                    <option value={5}>{t("settings.dayFriday")}</option>
                    <option value={6}>{t("settings.daySaturday")}</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={
                  !canUpdateSettings ||
                  chooseBackupDirectoryMutation.isPending ||
                  resetBackupDirectoryMutation.isPending
                }
                onClick={() => {
                  void chooseBackupDirectoryMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.chooseBackupFolder")}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={
                  !canUpdateSettings ||
                  chooseBackupDirectoryMutation.isPending ||
                  resetBackupDirectoryMutation.isPending
                }
                onClick={() => {
                  void resetBackupDirectoryMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.resetBackupFolder")}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={
                  !canUpdateSettings ||
                  !isBackupPolicyValid ||
                  saveBackupPolicyMutation.isPending
                }
                onClick={() => {
                  void saveBackupPolicyMutation.mutateAsync(backupPolicyForm);
                }}
                type="button"
              >
                {t("settings.saveBackupPolicy")}
              </button>
              <button
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:border-emerald-300 transition disabled:opacity-50"
                disabled={!canUpdateSettings || runBackupNowMutation.isPending}
                onClick={() => {
                  void runBackupNowMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.runBackupNow")}
              </button>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              <p>
                {t("settings.lastBackupAt")}:{" "}
                {desktopBackupPolicyQuery.data?.lastBackupAt
                  ? formatDate(desktopBackupPolicyQuery.data.lastBackupAt)
                  : "-"}
              </p>
              <p>
                {t("settings.lastBackupResult")}:{" "}
                {desktopBackupPolicyQuery.data?.lastBackupResult ?? "-"}
              </p>
              <p>
                {t("settings.nextBackupAt")}:{" "}
                {desktopBackupPolicyQuery.data?.nextScheduledBackupAt
                  ? formatDate(
                      desktopBackupPolicyQuery.data.nextScheduledBackupAt
                    )
                  : "-"}
              </p>
            </div>

            {desktopBackupPolicyQuery.data?.backups.length ? (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-600">
                    {t("settings.restoreSource")}
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                    disabled={!canUpdateSettings}
                    onChange={(event) =>
                      setSelectedBackupPath(event.target.value)
                    }
                    value={selectedBackupPath}
                  >
                    {desktopBackupPolicyQuery.data.backups.map((backup) => (
                      <option key={backup.path} value={backup.path}>
                        {backup.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    checked={restoreCheckOne}
                    className="mt-1"
                    disabled={!canUpdateSettings}
                    onChange={(event) =>
                      setRestoreCheckOne(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{t("settings.restoreAckOne")}</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    checked={restoreCheckTwo}
                    className="mt-1"
                    disabled={!canUpdateSettings}
                    onChange={(event) =>
                      setRestoreCheckTwo(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{t("settings.restoreAckTwo")}</span>
                </label>
                <button
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:border-amber-300 transition disabled:opacity-50"
                  disabled={
                    !canUpdateSettings ||
                    !selectedBackupPath ||
                    !canSubmitRestore ||
                    restoreBackupMutation.isPending
                  }
                  onClick={() => {
                    void restoreBackupMutation.mutateAsync(selectedBackupPath);
                  }}
                  type="button"
                >
                  {t("settings.restoreNow")}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                {t("settings.noBackupsYet")}
              </p>
            )}
            {chooseBackupDirectoryMutation.error ? (
              <p className="text-sm text-red-600">
                {(chooseBackupDirectoryMutation.error as Error).message}
              </p>
            ) : null}
            {resetBackupDirectoryMutation.error ? (
              <p className="text-sm text-red-600">
                {(resetBackupDirectoryMutation.error as Error).message}
              </p>
            ) : null}
            {saveBackupPolicyMutation.error ? (
              <p className="text-sm text-red-600">
                {(saveBackupPolicyMutation.error as Error).message}
              </p>
            ) : null}
            {runBackupNowMutation.error ? (
              <p className="text-sm text-red-600">
                {(runBackupNowMutation.error as Error).message}
              </p>
            ) : null}
            {restoreBackupMutation.error ? (
              <p className="text-sm text-red-600">
                {(restoreBackupMutation.error as Error).message}
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
      {user.permissions.includes("lookups:manage") ||
      user.permissions.includes("roles:read") ? (
        <SectionCard
          title={t("settings.administration")}
          description={t("settings.administrationHelp")}
        >
          <div className="flex flex-wrap gap-3">
            {user.permissions.includes("lookups:manage") ? (
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition"
                to="/app/settings/lookups"
              >
                {t("lookups.title")}
              </Link>
            ) : null}
            {user.permissions.includes("roles:read") ? (
              <Link
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition"
                to="/app/settings/roles"
              >
                {t("roles.title")}
              </Link>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title={t("settings.profileTitle")}
          description={t("settings.profileHelp")}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selfQuery.data) {
                return;
              }

              updateProfileMutation.mutate({
                fullName: profileForm.fullName,
                email: profileForm.email,
                preferredLanguage: profileForm.preferredLanguage,
                roleId: selfQuery.data.roleId,
                status: selfQuery.data.status
              });
            }}
          >
            <Field
              label={t("labels.fullName")}
              onChange={(value) =>
                setProfileForm({ ...profileForm, fullName: value })
              }
              value={profileForm.fullName}
            />
            <Field
              dir="ltr"
              label={t("labels.email")}
              onChange={(value) =>
                setProfileForm({ ...profileForm, email: value })
              }
              type="email"
              value={profileForm.email}
            />
            <SelectField
              label={t("labels.language")}
              onChange={(value) =>
                setProfileForm({
                  ...profileForm,
                  preferredLanguage: value as Language
                })
              }
              options={Object.values(Language).map((value) => ({
                value: value as string,
                label: getEnumLabel(t, "Language", value as string)
              }))}
              value={profileForm.preferredLanguage}
            />
            <PrimaryButton type="submit">
              {t("actions.saveChanges")}
            </PrimaryButton>
            {updateProfileMutation.error ? (
              <p className="text-sm text-red-600">
                {(updateProfileMutation.error as Error).message}
              </p>
            ) : null}
          </form>
        </SectionCard>
        <SectionCard
          title={t("settings.passwordTitle")}
          description={t("settings.passwordHelp")}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              changePasswordMutation.mutate(passwordForm);
            }}
          >
            <Field
              dir="ltr"
              label={t("settings.currentPassword")}
              onChange={(value) =>
                setPasswordForm({ ...passwordForm, currentPassword: value })
              }
              type="password"
              value={passwordForm.currentPassword}
            />
            <Field
              dir="ltr"
              label={t("settings.newPassword")}
              onChange={(value) =>
                setPasswordForm({ ...passwordForm, newPassword: value })
              }
              type="password"
              value={passwordForm.newPassword}
            />
            <PrimaryButton type="submit">
              {t("settings.changePassword")}
            </PrimaryButton>
            {changePasswordMutation.error ? (
              <p className="text-sm text-red-600">
                {(changePasswordMutation.error as Error).message}
              </p>
            ) : null}
          </form>
        </SectionCard>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
