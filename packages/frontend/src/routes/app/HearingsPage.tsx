import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SessionOutcome, type HearingListResponseDto, type HearingDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useTableQueryState } from "../../lib/tableQueryState";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SectionCard,
  SelectField,
  SortableTableHeadCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TablePagination,
  TableRow,
  TableWrapper,
  formatDateTime
} from "./ui";

function OutcomeCell({ hearing }: { hearing: HearingDto }) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (outcome: SessionOutcome | null) =>
      apiFetch(`/api/hearings/${hearing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          caseId: hearing.caseId,
          assignedLawyerId: hearing.assignedLawyerId,
          sessionDatetime: hearing.sessionDatetime,
          nextSessionAt: hearing.nextSessionAt,
          outcome,
          notes: hearing.notes
        })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hearings-management"] })
  });

  return (
    <select
      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-accent focus:outline-none disabled:opacity-50"
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate((e.target.value || null) as SessionOutcome | null)}
      value={hearing.outcome ?? ""}
    >
      <option value="">—</option>
      {Object.values(SessionOutcome).map((v) => (
        <option key={v} value={v}>
          {getEnumLabel(t, "SessionOutcome", v)}
        </option>
      ))}
    </select>
  );
}

export function HearingsPage() {
  const { t } = useTranslation("app");
  const table = useTableQueryState({
    defaultSortBy: "sessionDatetime",
    defaultSortDir: "asc",
    defaultLimit: 20,
    filterKeys: ["overdue"]
  });

  const hearingsQuery = useQuery({
    queryKey: ["hearings-management", table.state],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(`/api/hearings?${table.toApiQueryString()}`)
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("hearings.eyebrow")}
        title={t("hearings.title")}
        description={t("hearings.description")}
        actions={
          <Link className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white" to="/app/hearings/new">
            {t("hearings.newHearing")}
          </Link>
        }
      />

      <SectionCard title={t("hearings.title")} description={t("hearings.description")}>
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <Field
            label={t("labels.search")}
            value={table.state.q}
            onChange={table.setQ}
            placeholder={t("hearings.searchPlaceholder")}
          />
          <SelectField
            label={t("labels.status")}
            value={table.state.filters.overdue ?? ""}
            onChange={(value) => table.setFilter("overdue", value)}
            options={[
              { value: "", label: t("labels.all") },
              { value: "true", label: t("tasks.overdue") }
            ]}
          />
        </div>

        {hearingsQuery.isLoading ? <p className="text-sm text-slate-500">{t("labels.loading")}</p> : null}

        {hearingsQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={(hearingsQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void hearingsQuery.refetch()}
          />
        ) : null}

        {!hearingsQuery.isLoading && !hearingsQuery.isError && !hearingsQuery.data?.items.length ? (
          <EmptyState title={t("empty.noHearings")} description={t("empty.noHearingsHelp")} />
        ) : null}

        {!hearingsQuery.isLoading && !hearingsQuery.isError && !!hearingsQuery.data?.items.length ? (
          <>
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("labels.case")}</TableHeadCell>
                    <SortableTableHeadCell label={t("labels.sessionDatetime")} sortKey="sessionDatetime" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <TableHeadCell>{t("labels.assignedLawyer")}</TableHeadCell>
                    <SortableTableHeadCell label={t("labels.outcome")} sortKey="outcome" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {hearingsQuery.data.items.map((hearing) => (
                    <TableRow key={hearing.id}>
                      <TableCell>{hearing.caseTitle}</TableCell>
                      <TableCell>{formatDateTime(hearing.sessionDatetime)}</TableCell>
                      <TableCell>{hearing.assignedLawyerName ?? t("labels.unassigned")}</TableCell>
                      <TableCell><OutcomeCell hearing={hearing} /></TableCell>
                      <TableCell align="end">
                        <Link
                          className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          params={{ hearingId: hearing.id }}
                          to="/app/hearings/$hearingId/edit"
                        >
                          {t("actions.edit")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={hearingsQuery.data.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </>
        ) : null}
      </SectionCard>
    </div>
  );
}
