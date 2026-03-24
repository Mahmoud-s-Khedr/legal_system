import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthMode, Language, type CreateLocalUserDto, type RoleListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useAuthBootstrap } from "../../store/authStore";
import { EmptyState, Field, PageHeader, PrimaryButton, SectionCard, SelectField } from "./ui";

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
        <EmptyState title={t("users.cloudOnly")} description={t("users.cloudOnlyHelp")} />
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
      <SectionCard title={t("users.createTitle")} description={t("users.createHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <Field
            label={t("labels.fullName")}
            onChange={(value) => setForm({ ...form, fullName: value })}
            required
            value={form.fullName}
          />
          <Field
            dir="ltr"
            label={t("labels.email")}
            onChange={(value) => setForm({ ...form, email: value })}
            required
            type="email"
            value={form.email}
          />
          <Field
            dir="ltr"
            label={t("labels.password")}
            onChange={(value) => setForm({ ...form, password: value })}
            required
            type="password"
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
            value={form.roleId}
          />
          <SelectField
            label={t("labels.language")}
            onChange={(value) => setForm({ ...form, preferredLanguage: value as Language })}
            options={Object.values(Language).map((value) => ({
              value,
              label: getEnumLabel(t, "Language", value)
            }))}
            value={form.preferredLanguage ?? Language.AR}
          />
          <PrimaryButton type="submit">{t("actions.createUser")}</PrimaryButton>
          {createMutation.error ? (
            <p className="text-sm text-red-600">
              {(createMutation.error as Error).message?.toLowerCase().includes("seat limit")
                ? t("users.seatLimitReached")
                : t("errors.fallback")}
            </p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
