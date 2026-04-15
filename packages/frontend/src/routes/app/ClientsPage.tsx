import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientType, type ClientListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { EnumBadge } from "../../components/shared/EnumBadge";
import { getEnumLabel } from "../../lib/enumLabel";
import { useTableQueryState } from "../../lib/tableQueryState";
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

export function ClientsPage() {
  const { t } = useTranslation("app");
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["type"]
  });

  const clientsQuery = useQuery({
    queryKey: ["clients", table.state],
    queryFn: () =>
      apiFetch<ClientListResponseDto>(`/api/clients?${table.toApiQueryString()}`)
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.eyebrow")}
        title={t("clients.title")}
        description={t("clients.description")}
        stickyActions
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/clients/new"
          >
            {t("actions.newClient")}
          </Link>
        }
      />
      <SectionCard title={t("clients.directory")} description={t("clients.directoryHelp")}>
        <TableToolbar>
          <Field
            label={t("labels.search")}
            onChange={table.setQ}
            placeholder={t("clients.searchPlaceholder")}
            value={table.state.q}
          />
          <SelectField
            label={t("labels.type")}
            value={table.state.filters.type ?? ""}
            onChange={(value) => table.setFilter("type", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...Object.values(ClientType).map((value) => ({ value, label: getEnumLabel(t, "ClientType", value) }))
            ]}
          />
        </TableToolbar>
        <div className="mt-4 space-y-3">
          {clientsQuery.isLoading ? (
            <p className="text-sm text-slate-500">{t("labels.loading")}</p>
          ) : clientsQuery.isError ? (
            <ErrorState
              title={t("errors.title")}
              description={(clientsQuery.error as Error)?.message ?? t("errors.fallback")}
              retryLabel={t("errors.reload")}
              onRetry={() => void clientsQuery.refetch()}
            />
          ) : !clientsQuery.data?.items.length ? (
            <EmptyState title={t("empty.noClients")} description={t("empty.noClientsHelp")} />
          ) : (
            <>
              <ResponsiveDataList
                items={clientsQuery.data.items}
                getItemKey={(item) => item.id}
                fields={[
                  { key: "name", label: t("labels.name"), render: (item) => item.name },
                  { key: "email", label: t("labels.email"), render: (item) => item.email ?? "—" },
                  { key: "phone", label: t("labels.phone"), render: (item) => item.phone ?? "—" },
                  { key: "type", label: t("labels.type"), render: (item) => <EnumBadge enumName="ClientType" value={item.type} /> }
                ]}
                actions={(item) => (
                  <Link
                    className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    params={{ clientId: item.id }}
                    to="/app/clients/$clientId"
                  >
                    {t("actions.view")}
                  </Link>
                )}
              />
              <TableWrapper mobileMode="cards">
                <DataTable>
                  <TableHead>
                    <tr>
                      <SortableTableHeadCell label={t("labels.name")} sortKey="name" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                      <SortableTableHeadCell label={t("labels.email")} sortKey="email" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                      <TableHeadCell>{t("labels.phone")}</TableHeadCell>
                      <SortableTableHeadCell label={t("labels.type")} sortKey="type" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                      <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {clientsQuery.data.items.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>{client.name}</TableCell>
                        <TableCell>{client.email ?? "—"}</TableCell>
                        <TableCell>{client.phone ?? "—"}</TableCell>
                        <TableCell>
                          <EnumBadge enumName="ClientType" value={client.type} />
                        </TableCell>
                        <TableCell align="end">
                          <Link
                            className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            key={client.id}
                            params={{ clientId: client.id }}
                            to="/app/clients/$clientId"
                          >
                            {t("actions.view")}
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
                total={clientsQuery.data.total}
                onPageChange={table.setPage}
                onPageSizeChange={table.setLimit}
              />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
