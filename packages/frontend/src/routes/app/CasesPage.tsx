import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CaseStatus,
  type CaseListResponseDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useTableQueryState } from "../../lib/tableQueryState";
import { useLookupOptions } from "../../lib/lookups";
import { useAuthBootstrap } from "../../store/authStore";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  ResponsiveDataList,
  SectionCard,
  SelectField,
  SortableTableHeadCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TablePagination,
  TableRow,
  TableToolbar,
  TableWrapper
} from "./ui";

export function CasesPage() {
  const { t } = useTranslation("app");
  const { user } = useAuthBootstrap();
  const table = useTableQueryState({
    defaultSortBy: "updatedAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: [
      "status",
      "type",
      "assignedLawyerId",
      "createdFrom",
      "createdTo"
    ]
  });
  const [assignedToMe, setAssignedToMe] = useState(false);

  const caseTypesQuery = useLookupOptions("CaseType");
  const lawyersQuery = useQuery({
    queryKey: ["users-list"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const effectiveLawyerId = assignedToMe
    ? (user?.id ?? "")
    : (table.state.filters.assignedLawyerId ?? "");

  const extraParams = new URLSearchParams();
  if (effectiveLawyerId) extraParams.set("assignedLawyerId", effectiveLawyerId);
  if (table.state.filters.createdFrom)
    extraParams.set("createdFrom", table.state.filters.createdFrom);
  if (table.state.filters.createdTo)
    extraParams.set("createdTo", table.state.filters.createdTo);
  const extraStr = extraParams.toString();

  const casesQuery = useQuery({
    queryKey: ["cases", table.state, effectiveLawyerId],
    queryFn: () =>
      apiFetch<CaseListResponseDto>(
        `/api/cases?${table.toApiQueryString()}${extraStr ? `&${extraStr}` : ""}`
      )
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.eyebrow")}
        title={t("cases.title")}
        description={t("cases.description")}
        stickyActions
        actions={
          <>
            <Link
              className="rounded-2xl border border-accent px-4 py-3 font-semibold text-accent hover:bg-accent/5"
              to="/app/cases/quick-new"
            >
              {t("actions.quickIntake")}
            </Link>
            <Link
              className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
              to="/app/cases/new"
            >
              {t("actions.newCase")}
            </Link>
          </>
        }
      />
      <SectionCard
        title={t("cases.directory")}
        description={t("cases.directoryHelp")}
      >
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
              ...Object.values(CaseStatus).map((value) => ({
                value,
                label: getEnumLabel(t, "CaseStatus", value)
              }))
            ]}
            value={table.state.filters.status ?? ""}
          />
          <SelectField
            label={t("labels.caseType")}
            onChange={(value) => table.setFilter("type", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...(caseTypesQuery.data?.items ?? []).map((o) => ({
                value: o.key,
                label: o.labelAr ?? o.key
              }))
            ]}
            value={table.state.filters.type ?? ""}
          />
          <SelectField
            label={t("labels.lawyer")}
            onChange={(value) => {
              setAssignedToMe(false);
              table.setFilter("assignedLawyerId", value);
            }}
            options={[
              { value: "", label: t("labels.all") },
              ...(lawyersQuery.data?.items ?? []).map((u) => ({
                value: u.id,
                label: u.fullName
              }))
            ]}
            value={
              assignedToMe ? "" : (table.state.filters.assignedLawyerId ?? "")
            }
          />
        </TableToolbar>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAssignedToMe((v) => !v);
              table.setFilter("assignedLawyerId", "");
            }}
            className={`rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${assignedToMe ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {t("cases.assignedToMe", "Assigned to me")}
          </button>
          <Field
            label={t("labels.from")}
            type="date"
            value={table.state.filters.createdFrom ?? ""}
            onChange={(value) => table.setFilter("createdFrom", value)}
          />
          <Field
            label={t("labels.to")}
            type="date"
            value={table.state.filters.createdTo ?? ""}
            onChange={(value) => table.setFilter("createdTo", value)}
          />
        </div>
        {casesQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : casesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (casesQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void casesQuery.refetch()}
          />
        ) : !casesQuery.data?.items.length ? (
          <EmptyState
            title={t("empty.noCases")}
            description={t("empty.noCasesHelp")}
          />
        ) : (
          <>
            <ResponsiveDataList
              items={casesQuery.data.items}
              getItemKey={(item) => item.id}
              fields={[
                {
                  key: "title",
                  label: t("labels.caseTitle"),
                  render: (item) => item.title
                },
                {
                  key: "status",
                  label: t("labels.status"),
                  render: (item) => getEnumLabel(t, "CaseStatus", item.status)
                }
              ]}
              actions={(item) => (
                <Link
                  className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  params={{ caseId: item.id }}
                  to="/app/cases/$caseId"
                >
                  {t("actions.viewDocument")}
                </Link>
              )}
            />
            <TableWrapper mobileMode="cards">
              <DataTable>
                <TableHead>
                  <tr>
                    <SortableTableHeadCell
                      label={t("labels.caseTitle")}
                      sortKey="title"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <SortableTableHeadCell
                      label={t("labels.caseNumber")}
                      sortKey="caseNumber"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <SortableTableHeadCell
                      label={t("labels.status")}
                      sortKey="status"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <TableHeadCell align="end">
                      {t("actions.more")}
                    </TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {casesQuery.data.items.map((caseItem) => (
                    <TableRow key={caseItem.id}>
                      <TableCell>{caseItem.title}</TableCell>
                      <TableCell>{caseItem.caseNumber}</TableCell>
                      <TableCell>
                        {getEnumLabel(t, "CaseStatus", caseItem.status)}
                      </TableCell>
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
