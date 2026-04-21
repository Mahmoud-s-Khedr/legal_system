import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Language,
  UserStatus,
  type AdminSetPasswordDto,
  type RoleListResponseDto,
  type UpdateUserDto,
  type UserDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { confirmAction } from "../../lib/dialog";
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import {
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField
} from "./ui";

interface UserEditForm {
  fullName: string;
  email: string;
  roleId: string;
  preferredLanguage: Language;
  status: UserStatus;
}

export function UserDetailPage() {
  const { t } = useTranslation("app");
  const { userId } = useParams({ from: "/app/users/$userId" });
  const { user: currentUser } = useAuthBootstrap();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdateUsers =
    currentUser?.permissions.includes("users:update") ?? false;
  const canDeleteUsers =
    currentUser?.permissions.includes("users:delete") ?? false;
  const canReadRoles = currentUser?.permissions.includes("roles:read") ?? false;

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => apiFetch<UserDto>(`/api/users/${userId}`)
  });
  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleListResponseDto>("/api/roles?limit=1000"),
    enabled: canReadRoles
  });

  const [form, setForm] = useState<UserEditForm>({
    fullName: "",
    email: "",
    roleId: "",
    preferredLanguage: Language.AR,
    status: UserStatus.ACTIVE
  });
  const [passwordForm, setPasswordForm] = useState<AdminSetPasswordDto>({
    newPassword: ""
  });

  useEffect(() => {
    if (!userQuery.data) {
      return;
    }

    setForm({
      fullName: userQuery.data.fullName,
      email: userQuery.data.email,
      roleId: userQuery.data.roleId,
      preferredLanguage: userQuery.data.preferredLanguage as Language,
      status: userQuery.data.status as UserStatus
    });
  }, [userQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserDto) =>
      apiFetch<UserDto>(`/api/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      void navigate({ to: "/app/users" });
    }
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: UserStatus) =>
      apiFetch<UserDto>(`/api/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
    }
  });

  const passwordMutation = useMutation({
    mutationFn: (payload: AdminSetPasswordDto) =>
      apiFetch<{ success: true }>(`/api/users/${userId}/password`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setPasswordForm({ newPassword: "" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: true }>(`/api/users/${userId}`, {
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      void navigate({ to: "/app/users" });
    }
  });

  if (!userQuery.data && !userQuery.isLoading) {
    return (
      <EmptyState
        title={t("empty.noUsers")}
        description={t("empty.noUsersHelp")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("users.eyebrow")}
        title={userQuery.data?.fullName ?? "..."}
        description={t("users.manageHelp")}
        actions={
          <button
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            onClick={() => void navigate({ to: "/app/users" })}
            type="button"
          >
            {t("users.backToList")}
          </button>
        }
      />

      <SectionCard
        title={t("users.manageTitle")}
        description={t("users.manageHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(form);
          }}
        >
          <Field
            label={t("labels.fullName")}
            onChange={(value) => setForm({ ...form, fullName: value })}
            value={form.fullName}
          />
          <Field
            dir="ltr"
            label={t("labels.email")}
            onChange={(value) => setForm({ ...form, email: value })}
            type="email"
            value={form.email}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {canReadRoles ? (
              <SelectField
                label={t("labels.role")}
                onChange={(value) => setForm({ ...form, roleId: value })}
                options={[
                  { value: "", label: t("labels.selectRole") },
                  ...(rolesQuery.data?.items ?? []).map((role) => ({
                    value: role.id,
                    label: role.name
                  }))
                ]}
                value={form.roleId}
              />
            ) : null}
            <SelectField
              label={t("labels.status")}
              onChange={(value) =>
                setForm({ ...form, status: value as UserStatus })
              }
              options={Object.values(UserStatus).map((value) => ({
                value,
                label: getEnumLabel(t, "UserStatus", value)
              }))}
              value={form.status}
            />
          </div>
          <SelectField
            label={t("labels.language")}
            onChange={(value) =>
              setForm({ ...form, preferredLanguage: value as Language })
            }
            options={Object.values(Language).map((value) => ({
              value,
              label: getEnumLabel(t, "Language", value)
            }))}
            value={form.preferredLanguage}
          />
          <div className="flex flex-wrap gap-3">
            {canUpdateUsers ? (
              <PrimaryButton type="submit">
                {t("actions.saveChanges")}
              </PrimaryButton>
            ) : null}
            {canUpdateUsers ? (
              <button
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                onClick={() =>
                  statusMutation.mutate(
                    form.status === UserStatus.SUSPENDED
                      ? UserStatus.ACTIVE
                      : UserStatus.SUSPENDED
                  )
                }
                type="button"
              >
                {form.status === UserStatus.SUSPENDED
                  ? t("users.activateUser")
                  : t("users.deactivateUser")}
              </button>
            ) : null}
            {canDeleteUsers ? (
              <button
                className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600"
                onClick={() => {
                  void (async () => {
                    const approved = await confirmAction({
                      content: t("users.deleteConfirm"),
                      okButtonProps: { danger: true }
                    });
                    if (!approved) {
                      return;
                    }
                    await deleteMutation.mutateAsync();
                  })();
                }}
                type="button"
              >
                {t("users.deleteUser")}
              </button>
            ) : null}
          </div>
          {updateMutation.error ? (
            <p className="text-sm text-red-600">
              {(updateMutation.error as Error).message}
            </p>
          ) : null}
          {statusMutation.error ? (
            <p className="text-sm text-red-600">
              {(statusMutation.error as Error).message}
            </p>
          ) : null}
          {deleteMutation.error ? (
            <p className="text-sm text-red-600">
              {(deleteMutation.error as Error).message}
            </p>
          ) : null}
        </form>
      </SectionCard>

      {canUpdateUsers ? (
        <SectionCard
          title={t("users.passwordTitle")}
          description={t("users.passwordHelp")}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              passwordMutation.mutate(passwordForm);
            }}
          >
            <Field
              dir="ltr"
              label={t("users.newPassword")}
              onChange={(value) => setPasswordForm({ newPassword: value })}
              type="password"
              value={passwordForm.newPassword}
            />
            <PrimaryButton type="submit">
              {t("users.resetPassword")}
            </PrimaryButton>
            {passwordMutation.error ? (
              <p className="text-sm text-red-600">
                {(passwordMutation.error as Error).message}
              </p>
            ) : null}
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}
