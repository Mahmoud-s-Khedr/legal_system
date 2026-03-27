import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthMode, type InvitationListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useAuthBootstrap } from "../../store/authStore";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper, formatDateTime } from "./ui";

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
          {invitationsQuery.isError ? (
            <ErrorState
              title={t("errors.title")}
              description={(invitationsQuery.error as Error)?.message ?? t("errors.fallback")}
              retryLabel={t("errors.reload")}
              onRetry={() => void invitationsQuery.refetch()}
            />
          ) : !invitationsQuery.data?.items.length ? (
            <EmptyState title={t("empty.noInvitations")} description={t("empty.noInvitationsHelp")} />
          ) : (
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("labels.email")}</TableHeadCell>
                    <TableHeadCell>{t("labels.role")}</TableHeadCell>
                    <TableHeadCell>{t("labels.status")}</TableHeadCell>
                    <TableHeadCell>{t("labels.endDate")}</TableHeadCell>
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {invitationsQuery.data.items.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>{invite.roleName}</TableCell>
                      <TableCell>{invite.status}</TableCell>
                      <TableCell>{formatDateTime(invite.expiresAt)}</TableCell>
                      <TableCell align="end">
                        {invite.status === "PENDING" ? (
                          <button
                            className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                            onClick={() => revokeMutation.mutate(invite.id)}
                            type="button"
                          >
                            {t("actions.revoke")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
          )}
        </SectionCard>
      )}
    </div>
  );
}
