import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AuthMode,
  Language,
  type CreateLocalUserDto,
  type RoleListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { resolveFormValidationError } from "../../lib/formValidation";
import { useAuthBootstrap } from "../../store/authStore";
import { pickFieldError } from "../../lib/validationErrors";
import {
  EmptyState,
  ErrorState,
  Field,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField
} from "./ui";

export function UserCreatePage() {
  const { t } = useTranslation("app");
  const { mode } = useAuthBootstrap();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CreateLocalUserDto>({
    fullName: "",
    email: "",
    password: "",
    roleId: "",
    preferredLanguage: Language.AR
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleListResponseDto>("/api/roles"),
    enabled: mode === AuthMode.LOCAL
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateLocalUserDto) =>
      apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      void navigate({ to: "/app/users" });
    },
    onError: (err: unknown) => {
      const resolved = resolveFormValidationError(err, t("errors.fallback"));
      const message = resolved.message.toLowerCase().includes("seat limit")
        ? t("users.seatLimitReached")
        : resolved.message;
      setSubmitError(message);
      setFieldErrors(resolved.fieldErrors);
    }
  });

  if (mode !== AuthMode.LOCAL) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("users.eyebrow")}
          title={t("users.cloudTitle")}
          description={t("users.cloudHelp")}
        />
        <EmptyState
          title={t("users.cloudOnly")}
          description={t("users.cloudOnlyHelp")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("users.eyebrow")}
        title={t("users.createTitle")}
        description={t("users.createHelp")}
      />
      <SectionCard
        title={t("users.createTitle")}
        description={t("users.createHelp")}
      >
        {rolesQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : null}
        {rolesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (rolesQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void rolesQuery.refetch()}
          />
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitError(null);
            setFieldErrors({});
            createMutation.mutate(form);
          }}
        >
          <Field
            label={t("labels.fullName")}
            onChange={(value) => setForm({ ...form, fullName: value })}
            required
            error={pickFieldError(fieldErrors, ["fullName"]) ?? undefined}
            value={form.fullName}
          />
          <Field
            dir="ltr"
            label={t("labels.email")}
            onChange={(value) => setForm({ ...form, email: value })}
            required
            type="email"
            error={pickFieldError(fieldErrors, ["email"]) ?? undefined}
            value={form.email}
          />
          <Field
            dir="ltr"
            label={t("labels.password")}
            onChange={(value) => setForm({ ...form, password: value })}
            required
            type="password"
            error={pickFieldError(fieldErrors, ["password"]) ?? undefined}
            value={form.password}
          />
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
            required
            error={pickFieldError(fieldErrors, ["roleId"]) ?? undefined}
            value={form.roleId}
          />
          <SelectField
            label={t("labels.language")}
            onChange={(value) =>
              setForm({ ...form, preferredLanguage: value as Language })
            }
            options={Object.values(Language).map((value) => ({
              value,
              label: getEnumLabel(t, "Language", value)
            }))}
            error={pickFieldError(fieldErrors, ["preferredLanguage"]) ?? undefined}
            value={form.preferredLanguage ?? Language.AR}
          />
          <FormExitActions
            cancelTo="/app/users"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("actions.createUser")}
            savingLabel={t("labels.saving")}
            submitting={
              createMutation.isPending ||
              rolesQuery.isLoading ||
              rolesQuery.isError ||
              !rolesQuery.data?.items?.length
            }
          />
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        </form>
      </SectionCard>
    </div>
  );
}
