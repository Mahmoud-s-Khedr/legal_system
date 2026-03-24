import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthMode, type InvitationListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useAuthBootstrap } from "../../store/authStore";
import { EmptyState, PageHeader, SectionCard, formatDateTime } from "./ui";

export function InvitationsPage() {
  const { t } = useTranslation("app");
  const { mode } = useAuthBootstrap();
  const queryClient = useQueryClient();

  const invitationsQuery = useQuery({
    queryKey: ["invitations"],
    queryFn: () => apiFetch<InvitationListResponseDto>("/api/invitations"),
    enabled: mode === AuthMode.CLOUD
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/invitations/${id}/revoke`, {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invitations"] });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("invitations.eyebrow")}
        title={t("invitations.title")}
        description={t("invitations.description")}
        actions={
          mode === AuthMode.CLOUD ? (
            <Link
              className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
              to="/app/invitations/new"
            >
              {t("actions.newInvitation")}
            </Link>
          ) : undefined
        }
      />
      {mode !== AuthMode.CLOUD ? (
        <EmptyState title={t("invitations.cloudOnly")} description={t("invitations.cloudOnlyHelp")} />
      ) : (
        <SectionCard title={t("invitations.directory")} description={t("invitations.directoryHelp")}>
          {!invitationsQuery.data?.items.length ? (
            <EmptyState title={t("empty.noInvitations")} description={t("empty.noInvitationsHelp")} />
          ) : (
            <div className="space-y-3">
              {invitationsQuery.data.items.map((invite) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-4" key={invite.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{invite.email}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {invite.roleName} · {invite.status}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(invite.expiresAt)}</p>
                    </div>
                    {invite.status === "PENDING" ? (
                      <button
                        className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                        onClick={() => revokeMutation.mutate(invite.id)}
                        type="button"
                      >
                        {t("actions.revoke")}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
