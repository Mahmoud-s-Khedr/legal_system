import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthMode, type InvitationListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useTableQueryState } from "../../lib/tableQueryState";
import { useAuthBootstrap } from "../../store/authStore";
import { DataTable, EmptyState, ErrorState, Field, PageHeader, SectionCard, SelectField, SortableTableHeadCell, TableBody, TableCell, TableHead, TableHeadCell, TablePagination, TableRow, TableToolbar, TableWrapper, formatDateTime } from "./ui";

export function InvitationsPage() {
  const { t } = useTranslation("app");
  const { mode } = useAuthBootstrap();
  const queryClient = useQueryClient();
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["status"]
  });

  const invitationsQuery = useQuery({
    queryKey: ["invitations", table.state],
    queryFn: () => apiFetch<InvitationListResponseDto>(`/api/invitations?${table.toApiQueryString()}`),
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
          <TableToolbar>
            <Field
              label={t("labels.search")}
              value={table.state.q}
              onChange={table.setQ}
              placeholder={t("invitations.searchPlaceholder")}
            />
            <SelectField
              label={t("labels.status")}
              value={table.state.filters.status ?? ""}
              onChange={(value) => table.setFilter("status", value)}
              options={[
                { value: "", label: t("labels.all") },
                { value: "PENDING", label: "PENDING" },
                { value: "ACCEPTED", label: "ACCEPTED" },
                { value: "EXPIRED", label: "EXPIRED" },
                { value: "REVOKED", label: "REVOKED" }
              ]}
            />
          </TableToolbar>
          {invitationsQuery.isError ? (
            <ErrorState
              title={t("errors.title")}
              description={(invitationsQuery.error as Error)?.message ?? t("errors.fallback")}
              retryLabel={t("errors.reload")}
              onRetry={() => void invitationsQuery.refetch()}
            />
          ) : invitationsQuery.isLoading ? (
            <p className="text-sm text-slate-500">{t("labels.loading")}</p>
          ) : !invitationsQuery.data?.items.length ? (
            <EmptyState title={t("empty.noInvitations")} description={t("empty.noInvitationsHelp")} />
          ) : (
            <>
              <TableWrapper>
                <DataTable>
                  <TableHead>
                    <tr>
                      <SortableTableHeadCell label={t("labels.email")} sortKey="email" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                      <TableHeadCell>{t("labels.role")}</TableHeadCell>
                      <SortableTableHeadCell label={t("labels.status")} sortKey="status" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                      <SortableTableHeadCell label={t("labels.endDate")} sortKey="expiresAt" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
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
                              disabled={revokeMutation.isPending}
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
              <TablePagination
                page={table.state.page}
                pageSize={table.state.limit}
                total={invitationsQuery.data.total}
                onPageChange={table.setPage}
                onPageSizeChange={table.setLimit}
              />
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
}
