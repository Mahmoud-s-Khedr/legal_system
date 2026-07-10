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
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import { useMutationFeedback } from "../../lib/feedback";
import { resolveFormValidationError } from "../../lib/formValidation";
import { pickFieldError } from "../../lib/validationErrors";
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
import { PERMISSIONS, usePermission } from "../../lib/permissions";

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

export function groupPermissionsByResource(permissions: string[]) {
  return permissions.reduce<Record<string, string[]>>((acc, perm) => {
    const resource = perm.split(":")[0] ?? perm;
    (acc[resource] ??= []).push(perm);
    return acc;
  }, {});
}

export function SettingsPage() {
  const { t } = useTranslation("app");
  const { user, refreshSession } = useAuthBootstrap();
  const canReadFirm = usePermission(PERMISSIONS.firmsRead);
  const feedback = useMutationFeedback();
  const queryClient = useQueryClient();
  const firmQuery = useQuery({
    queryKey: ["firm-me"],
    queryFn: () => apiFetch<FirmMeResponseDto>("/api/firms/me"),
    enabled: canReadFirm
  });
  const selfQuery = useQuery({
    queryKey: ["user", user?.id],
    queryFn: () => apiFetch<UserDto>(`/api/users/${user?.id}`),
    enabled: Boolean(user?.id)
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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});
  const [activationKey, setActivationKey] = useState("");
  const [editionChangeTarget, setEditionChangeTarget] = useState<EditionKey>(
    EditionKey.SOLO_OFFLINE
  );
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

  const updateProfileMutation = useMutation({
    mutationFn: (payload: UpdateUserDto) =>
      apiFetch<UserDto>(`/api/users/${user?.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setProfileError(null);
      setProfileFieldErrors({});
      feedback.success("messages.saved");
      await queryClient.invalidateQueries({ queryKey: ["user", user?.id] });
      await refreshSession();
    },
    onError: (err: unknown) => {
      const resolved = resolveFormValidationError(err, t("errors.fallback"));
      setProfileError(resolved.message);
      setProfileFieldErrors(resolved.fieldErrors);
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
      setPasswordError(null);
      setPasswordFieldErrors({});
      feedback.success("messages.passwordChangedSuccessfully");
    },
    onError: (err: unknown) => {
      const resolved = resolveFormValidationError(err, t("errors.fallback"));
      setPasswordError(resolved.message);
      setPasswordFieldErrors(resolved.fieldErrors);
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
      feedback.success("messages.editionChangedSuccessfully");
      await queryClient.invalidateQueries({ queryKey: ["firm-me"] });
      await refreshSession();
    }
  });

  if (!user) {
    return (
      <EmptyState
        title={t("empty.noSettings")}
        description={t("empty.noSettingsHelp")}
      />
    );
  }

  const firm = firmQuery.data?.firm ?? null;
  const canSelfServeLicense =
    firm !== null && firm.editionKey !== EditionKey.ENTERPRISE;
  const selectableEditions = getSelectableEditionKeys();
  const trialDaysRemaining = getTrialDaysRemaining(
    firm?.trialEnabled ?? false,
    firm?.trialEndsAt
  );
  const trialCountdownText = (() => {
    if (trialDaysRemaining === null || !firm?.trialEndsAt) {
      return null;
    }
    return t("settings.trialActiveWithCountdown", {
      count: trialDaysRemaining,
      endDate: formatDate(firm.trialEndsAt)
    });
  })();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        {firm ? (
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
        ) : null}
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
      {firm ? (
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
      ) : null}
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
              setProfileError(null);
              setProfileFieldErrors({});

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
              error={pickFieldError(profileFieldErrors, ["fullName"]) ?? undefined}
              value={profileForm.fullName}
            />
            <Field
              dir="ltr"
              label={t("labels.email")}
              onChange={(value) =>
                setProfileForm({ ...profileForm, email: value })
              }
              type="email"
              error={pickFieldError(profileFieldErrors, ["email"]) ?? undefined}
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
              error={pickFieldError(profileFieldErrors, ["preferredLanguage"]) ?? undefined}
              options={Object.values(Language).map((value) => ({
                value: value as string,
                label: getEnumLabel(t, "Language", value as string)
              }))}
              value={profileForm.preferredLanguage}
            />
            <PrimaryButton type="submit">
              {t("actions.saveChanges")}
            </PrimaryButton>
            {profileError ? (
              <p className="text-sm text-red-600">
                {profileError}
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
              setPasswordError(null);
              setPasswordFieldErrors({});
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
              error={pickFieldError(passwordFieldErrors, ["currentPassword"]) ?? undefined}
              value={passwordForm.currentPassword}
            />
            <Field
              dir="ltr"
              label={t("settings.newPassword")}
              onChange={(value) =>
                setPasswordForm({ ...passwordForm, newPassword: value })
              }
              type="password"
              error={pickFieldError(passwordFieldErrors, ["newPassword"]) ?? undefined}
              value={passwordForm.newPassword}
            />
            <PrimaryButton type="submit">
              {t("settings.changePassword")}
            </PrimaryButton>
            {passwordError ? (
              <p className="text-sm text-red-600">
                {passwordError}
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
