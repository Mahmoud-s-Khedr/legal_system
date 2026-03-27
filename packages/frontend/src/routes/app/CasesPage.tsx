import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CaseStatus, type CaseListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useTableQueryState } from "../../lib/tableQueryState";
import { DataTable, EmptyState, ErrorState, Field, PageHeader, SectionCard, SelectField, SortableTableHeadCell, TableBody, TableCell, TableHead, TableHeadCell, TablePagination, TableRow, TableToolbar, TableWrapper } from "./ui";

export function CasesPage() {
  const { t } = useTranslation("app");
  const table = useTableQueryState({
    defaultSortBy: "updatedAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["status"]
  });

  const casesQuery = useQuery({
    queryKey: ["cases", table.state],
    queryFn: () => apiFetch<CaseListResponseDto>(`/api/cases?${table.toApiQueryString()}`)
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.eyebrow")}
        title={t("cases.title")}
        description={t("cases.description")}
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/cases/new"
          >
            {t("actions.newCase")}
          </Link>
        }
      />
      <SectionCard title={t("cases.directory")} description={t("cases.directoryHelp")}>
        <TableToolbar>
          <Field
            label={t("labels.search")}
            onChange={table.setQ}
            placeholder={t("cases.searchPlaceholder")}
            value={table.state.q}
          />
          <SelectField
            label={t("labels.status")}
            onChange={(value) => table.setFilter("status", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...Object.values(CaseStatus).map((value) => ({ value, label: getEnumLabel(t, "CaseStatus", value) }))
            ]}
            value={table.state.filters.status ?? ""}
          />
        </TableToolbar>
        {casesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={(casesQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void casesQuery.refetch()}
          />
        ) : !casesQuery.data?.items.length ? (
          <EmptyState title={t("empty.noCases")} description={t("empty.noCasesHelp")} />
        ) : (
          <>
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <SortableTableHeadCell label={t("labels.title")} sortKey="title" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <SortableTableHeadCell label={t("labels.caseNumber")} sortKey="caseNumber" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <SortableTableHeadCell label={t("labels.status")} sortKey="status" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {casesQuery.data.items.map((caseItem) => (
                    <TableRow key={caseItem.id}>
                      <TableCell>{caseItem.title}</TableCell>
                      <TableCell>{caseItem.caseNumber}</TableCell>
                      <TableCell>{getEnumLabel(t, "CaseStatus", caseItem.status)}</TableCell>
                      <TableCell align="end">
                        <Link
                          className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          key={caseItem.id}
                          params={{ caseId: caseItem.id }}
                          to="/app/cases/$caseId"
                        >
                          {t("actions.viewDocument")}
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
              total={casesQuery.data.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}
