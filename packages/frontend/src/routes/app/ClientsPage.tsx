import { useDeferredValue, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ClientListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { EnumBadge } from "../../components/shared/EnumBadge";
import { DataTable, EmptyState, ErrorState, Field, PageHeader, SectionCard, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper } from "./ui";

export function ClientsPage() {
  const { t } = useTranslation("app");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const clientsQuery = useQuery({
    queryKey: ["clients", deferredSearch],
    queryFn: () =>
      apiFetch<ClientListResponseDto>(
        deferredSearch ? `/api/clients?search=${encodeURIComponent(deferredSearch)}` : "/api/clients"
      )
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.eyebrow")}
        title={t("clients.title")}
        description={t("clients.description")}
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
        <Field
          label={t("labels.search")}
          onChange={setSearch}
          placeholder={t("clients.searchPlaceholder")}
          value={search}
        />
        <div className="mt-4 space-y-3">
          {clientsQuery.isError ? (
            <ErrorState
              title={t("errors.title")}
              description={(clientsQuery.error as Error)?.message ?? t("errors.fallback")}
              retryLabel={t("errors.reload")}
              onRetry={() => void clientsQuery.refetch()}
            />
          ) : !clientsQuery.data?.items.length ? (
            <EmptyState title={t("empty.noClients")} description={t("empty.noClientsHelp")} />
          ) : (
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("labels.name")}</TableHeadCell>
                    <TableHeadCell>{t("labels.email")}</TableHeadCell>
                    <TableHeadCell>{t("labels.phone")}</TableHeadCell>
                    <TableHeadCell>{t("labels.type")}</TableHeadCell>
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
                          {t("actions.viewDocument")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
