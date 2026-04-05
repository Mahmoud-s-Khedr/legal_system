import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateRoleDto, SetRolePermissionsDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { Field, FormExitActions, PageHeader, SectionCard } from "./ui";
import { PermissionChecklist } from "../../components/shared/PermissionChecklist";

export function RoleCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CreateRoleDto>({ key: "", name: "" });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateRoleDto) => {
      const role = await apiFetch<{ id: string }>("/api/roles", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (permissions.length > 0) {
        const setPermsPayload: SetRolePermissionsDto = { permissionKeys: permissions };
        await apiFetch(`/api/roles/${role.id}/permissions`, {
          method: "PUT",
          body: JSON.stringify(setPermsPayload)
        });
      }
      return role;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      void navigate({ to: "/app/settings/roles" });
    },
    onError: (err: Error) => setError(err.message)
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("roles.title")}
        title={t("roles.createRole")}
        description={t("roles.createHelp")}
      />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void createMutation.mutateAsync(form);
        }}
      >
        <SectionCard title={t("roles.identity")} description={t("roles.identityHelp")}>
          <div className="space-y-4">
            <Field
              dir="ltr"
              label={t("roles.roleKey")}
              onChange={(v) => setForm({ ...form, key: v.toLowerCase().replace(/\s+/g, "_") })}
              placeholder="my_custom_role"
              required
              value={form.key}
            />
            <Field
              label={t("labels.name")}
              onChange={(v) => setForm({ ...form, name: v })}
              required
              value={form.name}
            />
          </div>
        </SectionCard>
        <SectionCard title={t("roles.permissions")} description={t("roles.permissionsHelp")}>
          <PermissionChecklist onChange={setPermissions} selected={permissions} />
        </SectionCard>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <FormExitActions
          cancelTo="/app/settings/roles"
          cancelLabel={t("actions.cancel")}
          submitLabel={t("roles.createRole")}
          savingLabel={t("labels.saving")}
          submitting={createMutation.isPending}
        />
      </form>
    </div>
  );
}
