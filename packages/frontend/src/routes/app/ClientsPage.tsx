import { useDeferredValue, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ClientListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { EnumBadge } from "../../components/shared/EnumBadge";
import { EmptyState, ErrorState, Field, PageHeader, SectionCard } from "./ui";

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
            clientsQuery.data.items.map((client) => (
              <Link
                className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent"
                key={client.id}
                params={{ clientId: client.id }}
                to="/app/clients/$clientId"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{client.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {client.email ?? client.phone ?? t("labels.noContact")}
                    </p>
                  </div>
                  <EnumBadge enumName="ClientType" value={client.type} />
                </div>
              </Link>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
