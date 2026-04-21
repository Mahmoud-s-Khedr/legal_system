import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AuthMode,
  type CreateInvitationDto,
  type RoleListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useAuthBootstrap } from "../../store/authStore";
import {
  EmptyState,
  Field,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField
} from "./ui";

export function InvitationCreatePage() {
  const { t } = useTranslation("app");
  const { mode } = useAuthBootstrap();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CreateInvitationDto>({
    email: "",
    roleId: ""
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleListResponseDto>("/api/roles"),
    enabled: mode === AuthMode.CLOUD
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateInvitationDto) =>
      apiFetch("/api/invitations", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invitations"] });
      void navigate({ to: "/app/invitations" });
    }
  });

  if (mode !== AuthMode.CLOUD) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("invitations.eyebrow")}
          title={t("invitations.title")}
          description={t("invitations.description")}
        />
        <EmptyState
          title={t("invitations.cloudOnly")}
          description={t("invitations.cloudOnlyHelp")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("invitations.eyebrow")}
        title={t("invitations.createTitle")}
        description={t("invitations.createHelp")}
      />
      <SectionCard
        title={t("invitations.createTitle")}
        description={t("invitations.createHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate({
              ...form,
              email: form.email.trim().toLowerCase()
            });
          }}
        >
          <Field
            label={t("labels.email")}
            onChange={(value) => setForm({ ...form, email: value })}
            required
            type="email"
            value={form.email}
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
          <PrimaryButton
            type="submit"
            disabled={
              createMutation.isPending || !form.email.trim() || !form.roleId
            }
          >
            {t("actions.sendInvite")}
          </PrimaryButton>
          {createMutation.error ? (
            <p className="text-sm text-red-600">
              {(createMutation.error as Error).message}
            </p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
