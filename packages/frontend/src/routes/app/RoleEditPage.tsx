import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleDto, RoleListResponseDto, SetRolePermissionsDto, UpdateRoleDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { EmptyState, Field, FormExitActions, PageHeader, SectionCard } from "./ui";
import { PermissionChecklist } from "../../components/shared/PermissionChecklist";

export function RoleEditPage() {
  const { t } = useTranslation("app");
  const { roleId } = useParams({ from: "/app/settings/roles/$roleId/edit" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleListResponseDto>("/api/roles")
  });

  const role: RoleDto | undefined = rolesQuery.data?.items.find((r) => r.id === roleId);

  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      setName(role.name);
      setPermissions(role.permissions);
    }
  }, [role]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateRoleDto) => {
      await apiFetch(`/api/roles/${roleId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      const setPermsPayload: SetRolePermissionsDto = { permissionKeys: permissions };
      await apiFetch(`/api/roles/${roleId}/permissions`, {
        method: "PUT",
        body: JSON.stringify(setPermsPayload)
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      void navigate({ to: "/app/settings/roles" });
    },
    onError: (err: Error) => setError(err.message)
  });

  if (rolesQuery.isLoading) {
    return null;
  }

  if (!role) {
    return <EmptyState title={t("empty.noRoleFound")} description={t("empty.noRoleFoundHelp")} />;
  }

  if (role.firmId === null) {
    return <EmptyState title={t("roles.systemRoleEdit")} description={t("roles.systemRoleEditHelp")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("roles.title")}
        title={t("roles.editRole")}
        description={t("roles.editHelp")}
      />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void updateMutation.mutateAsync({ name });
        }}
      >
        <SectionCard title={t("roles.identity")} description={t("roles.identityHelp")}>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">{t("roles.roleKey")}</p>
              <p className="mt-1 font-mono text-sm text-slate-700">{role.key}</p>
            </div>
            <Field
              label={t("labels.name")}
              onChange={setName}
              required
              value={name}
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
          submitLabel={t("actions.saveChanges")}
          savingLabel={t("labels.saving")}
          submitting={updateMutation.isPending}
        />
      </form>
    </div>
  );
}
