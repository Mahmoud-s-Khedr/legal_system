import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { confirmAction } from "../../lib/dialog";
import { getEnumLabel } from "../../lib/enumLabel";
import { useToastStore } from "../../store/toastStore";
import { EmptyState, ErrorState, PageHeader, SectionCard } from "./ui";

export function RoleSettingsPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleListResponseDto>("/api/roles?limit=1000")
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) =>
      apiFetch(`/api/roles/${roleId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: Error) => {
      addToast(error.message || t("errors.fallback"), "error");
    }
  });

  const roles = rolesQuery.data?.items ?? [];
  const systemRoles = roles.filter((r) => r.firmId === null);
  const firmRoles = roles.filter((r) => r.firmId !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/settings/roles/new"
          >
            {t("roles.createRole")}
          </Link>
        }
        eyebrow={t("settings.eyebrow")}
        title={t("roles.title")}
        description={t("roles.description")}
      />

      {rolesQuery.isLoading ? <p className="text-sm text-slate-500">{t("labels.loading")}</p> : null}
      {rolesQuery.isError ? (
        <ErrorState
          title={t("errors.title")}
          description={(rolesQuery.error as Error)?.message ?? t("errors.fallback")}
          retryLabel={t("errors.reload")}
          onRetry={() => void rolesQuery.refetch()}
        />
      ) : null}

      {!rolesQuery.isLoading && !rolesQuery.isError && firmRoles.length > 0 ? (
        <SectionCard title={t("roles.firmRoles")} description={t("roles.firmRolesHelp")}>
          <div className="space-y-3">
            {firmRoles.map((role) => (
              <article
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
                key={role.id}
              >
                <div>
                  <p className="font-semibold">{role.firmId === null ? getEnumLabel(t, "UserRole", role.key) : role.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {role.firmId === null ? getEnumLabel(t, "UserRole", role.key) : role.key} · {role.permissions.length} {t("roles.permissionsCount")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    to="/app/settings/roles/$roleId/edit"
                    params={{ roleId: role.id }}
                  >
                    {t("actions.edit")}
                  </Link>
                  <button
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    onClick={() => {
                      void (async () => {
                        const approved = await confirmAction({
                          content: t("roles.deleteConfirm"),
                          okButtonProps: { danger: true }
                        });
                        if (!approved) {
                          return;
                        }
                        deleteMutation.mutate(role.id);
                      })();
                    }}
                    type="button"
                  >
                    {t("actions.delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : !rolesQuery.isLoading && !rolesQuery.isError ? (
        <SectionCard title={t("roles.firmRoles")} description={t("roles.firmRolesHelp")}>
          <EmptyState title={t("empty.noFirmRoles")} description={t("empty.noFirmRolesHelp")} />
        </SectionCard>
      ) : null}

      {!rolesQuery.isLoading && !rolesQuery.isError ? (
        <SectionCard title={t("roles.systemRoles")} description={t("roles.systemRolesHelp")}>
        <div className="space-y-3">
          {systemRoles.map((role) => (
            <article
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 opacity-75"
              key={role.id}
            >
              <div>
                <p className="font-semibold">{getEnumLabel(t, "UserRole", role.key)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {getEnumLabel(t, "UserRole", role.key)} · {role.permissions.length} {t("roles.permissionsCount")}
                </p>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                {t("lookups.system")}
              </span>
            </article>
          ))}
        </div>
      </SectionCard>
      ) : null}
    </div>
  );
}
