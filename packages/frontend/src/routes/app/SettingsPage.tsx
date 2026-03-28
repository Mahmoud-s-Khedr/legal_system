import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Language, type ChangeOwnPasswordDto, type FirmMeResponseDto, type UpdateUserDto, type UserDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import {
  chooseDesktopDownloadDirectory,
  getDesktopDownloadSettings,
  isDesktopDownloadsEnabled,
  resetDesktopDownloadDirectory
} from "../../lib/desktopDownloads";
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import { Badge, EmptyState, Field, PageHeader, PrimaryButton, SectionCard, SelectField } from "./ui";

export function SettingsPage() {
  const { t } = useTranslation("app");
  const isDesktopShell = isDesktopDownloadsEnabled();
  const { user, refreshSession } = useAuthBootstrap();
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

  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    preferredLanguage: Language.AR
  });
  const [passwordForm, setPasswordForm] = useState<ChangeOwnPasswordDto>({
    currentPassword: "",
    newPassword: ""
  });

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
      await queryClient.invalidateQueries({ queryKey: ["desktop-download-settings"] });
    }
  });
  const resetDownloadDirectoryMutation = useMutation({
    mutationFn: () => resetDesktopDownloadDirectory(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["desktop-download-settings"] });
    }
  });

  if (!firmQuery.data || !user) {
    return <EmptyState title={t("empty.noSettings")} description={t("empty.noSettingsHelp")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("settings.firm")} description={t("settings.firmHelp")}>
          <dl className="space-y-3 text-sm">
            <Detail label={t("labels.name")} value={firmQuery.data.firm.name} />
            <Detail label={t("labels.slug")} value={firmQuery.data.firm.slug} />
            <Detail label={t("labels.type")} value={getEnumLabel(t, "FirmType", firmQuery.data.firm.type)} />
            <Detail label={t("labels.language")} value={getEnumLabel(t, "Language", firmQuery.data.firm.defaultLanguage)} />
          </dl>
        </SectionCard>
        <SectionCard title={t("settings.session")} description={t("settings.sessionHelp")}>
          <dl className="space-y-3 text-sm">
            <Detail label={t("labels.fullName")} value={user.fullName} />
            <Detail label={t("labels.email")} value={user.email} />
            <Detail label={t("labels.role")} value={getEnumLabel(t, "UserRole", user.roleKey)} />
            <Detail label={t("labels.language")} value={getEnumLabel(t, "Language", user.preferredLanguage)} />
          </dl>
        </SectionCard>
        <SectionCard title={t("settings.permissions")} description={t("settings.permissionsHelp")}>
          <div className="space-y-4">
            {Object.entries(
              user.permissions.reduce<Record<string, string[]>>((acc, perm) => {
                const resource = perm.split(":")[0] ?? perm;
                (acc[resource] ??= []).push(perm);
                return acc;
              }, {})
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
      <SectionCard title={t("notifications.preferences")} description={t("notifications.preferencesDescription")}>
        <Link
          className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition"
          to="/app/settings/notifications"
        >
          {t("notifications.channelSettings")}
        </Link>
      </SectionCard>
      {isDesktopShell ? (
        <SectionCard title={t("settings.downloadsTitle")} description={t("settings.downloadsHelp")}>
          <div className="space-y-3">
            <Detail
              label={t("settings.downloadsCurrent")}
              value={desktopDownloadSettingsQuery.data?.effectivePath ?? t("labels.loading")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={chooseDownloadDirectoryMutation.isPending || resetDownloadDirectoryMutation.isPending}
                onClick={() => {
                  void chooseDownloadDirectoryMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.chooseDownloadFolder")}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-accent hover:text-accent transition disabled:opacity-50"
                disabled={chooseDownloadDirectoryMutation.isPending || resetDownloadDirectoryMutation.isPending}
                onClick={() => {
                  void resetDownloadDirectoryMutation.mutateAsync();
                }}
                type="button"
              >
                {t("settings.resetDownloadFolder")}
              </button>
            </div>
            {chooseDownloadDirectoryMutation.error ? (
              <p className="text-sm text-red-600">{(chooseDownloadDirectoryMutation.error as Error).message}</p>
            ) : null}
            {resetDownloadDirectoryMutation.error ? (
              <p className="text-sm text-red-600">{(resetDownloadDirectoryMutation.error as Error).message}</p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
      {(user.permissions.includes("lookups:manage") || user.permissions.includes("roles:read")) ? (
        <SectionCard title={t("settings.administration")} description={t("settings.administrationHelp")}>
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
        <SectionCard title={t("settings.profileTitle")} description={t("settings.profileHelp")}>
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
              onChange={(value) => setProfileForm({ ...profileForm, fullName: value })}
              value={profileForm.fullName}
            />
            <Field
              dir="ltr"
              label={t("labels.email")}
              onChange={(value) => setProfileForm({ ...profileForm, email: value })}
              type="email"
              value={profileForm.email}
            />
            <SelectField
              label={t("labels.language")}
              onChange={(value) =>
                setProfileForm({ ...profileForm, preferredLanguage: value as Language })
              }
              options={Object.values(Language).map((value) => ({
                value,
                label: getEnumLabel(t, "Language", value)
              }))}
              value={profileForm.preferredLanguage}
            />
            <PrimaryButton type="submit">{t("actions.saveChanges")}</PrimaryButton>
            {updateProfileMutation.error ? (
              <p className="text-sm text-red-600">{(updateProfileMutation.error as Error).message}</p>
            ) : null}
          </form>
        </SectionCard>
        <SectionCard title={t("settings.passwordTitle")} description={t("settings.passwordHelp")}>
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
              onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })}
              type="password"
              value={passwordForm.currentPassword}
            />
            <Field
              dir="ltr"
              label={t("settings.newPassword")}
              onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
              type="password"
              value={passwordForm.newPassword}
            />
            <PrimaryButton type="submit">{t("settings.changePassword")}</PrimaryButton>
            {changePasswordMutation.error ? (
              <p className="text-sm text-red-600">{(changePasswordMutation.error as Error).message}</p>
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
