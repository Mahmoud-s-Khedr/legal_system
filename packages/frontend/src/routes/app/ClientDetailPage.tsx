import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ClientDto } from "@elms/shared";
import { InvoiceStatus } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { EnumBadge } from "../../components/shared/EnumBadge";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper } from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { useInvoices } from "../../lib/billing";

export function ClientDetailPage() {
  const { t } = useTranslation("app");
  const { clientId } = useParams({ from: "/app/clients/$clientId" });
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => apiFetch<ClientDto>(`/api/clients/${clientId}`)
  });
  const invoicesQuery = useInvoices({ clientId });

  const client = clientQuery.data;

  if (!client) {
    return <EmptyState title={t("empty.noClientSelected")} description={t("empty.noClientSelectedHelp")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.profileEyebrow")}
        title={client.name}
        description={client.email ?? t("labels.noContact")}
        actions={
          <div className="flex items-center gap-3">
            <EnumBadge enumName="ClientType" value={client.type} />
            <Link
              className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
              params={{ clientId }}
              to="/app/clients/$clientId/edit"
            >
              {t("clients.editTitle")}
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("clients.profile")} description={t("clients.profileHelp")}>
          <dl className="space-y-3 text-sm">
            <Detail label={t("labels.email")} value={client.email} />
            <Detail label={t("labels.phone")} value={client.phone} />
            <Detail label={t("labels.governorate")} value={client.governorate} />
            <Detail label={t("labels.language")} value={getEnumLabel(t, "Language", client.preferredLanguage)} />
          </dl>
        </SectionCard>
        <SectionCard title={t("clients.linkedSummary")} description={t("clients.linkedSummaryHelp")}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Metric label={t("labels.cases")} value={client.linkedCaseCount} />
            <Metric label={t("labels.invoices")} value={client.invoiceCount} />
            <Metric label={t("labels.documents")} value={client.documentCount} />
          </dl>
        </SectionCard>
        <SectionCard title={t("clients.contacts")} description={t("clients.contactsHelp")}>
          {!client.contacts.length ? (
            <EmptyState title={t("empty.noContacts")} description={t("empty.noContactsHelp")} />
          ) : (
            <div className="space-y-3">
              {client.contacts.map((contact) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-4" key={contact.id}>
                  <p className="font-semibold">{contact.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {contact.phone} · {contact.email ?? t("labels.noEmail")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <SectionCard title={t("labels.invoices")} description={t("billing.invoicesDescription")}>
        {invoicesQuery.isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
        {!invoicesQuery.isLoading && invoicesQuery.isError && (
          <ErrorState
            title={t("errors.title")}
            description={(invoicesQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void invoicesQuery.refetch()}
          />
        )}
        {!invoicesQuery.isLoading && !invoicesQuery.isError && !invoicesQuery.data?.items.length && (
          <EmptyState title={t("empty.noInvoices")} description={t("empty.noInvoicesHelp")} />
        )}
        {!invoicesQuery.isLoading && !invoicesQuery.isError && !!invoicesQuery.data?.items.length && (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("billing.invoice")}</TableHeadCell>
                  <TableHeadCell>{t("labels.case")}</TableHeadCell>
                  <TableHeadCell>{t("labels.status")}</TableHeadCell>
                  <TableHeadCell align="end">{t("billing.amount")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {invoicesQuery.data.items.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        key={invoice.id}
                        to="/app/invoices/$invoiceId"
                        params={{ invoiceId: invoice.id }}
                        className="font-medium text-accent hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.caseTitle ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          invoice.status === InvoiceStatus.PAID
                            ? "bg-emerald-100 text-emerald-800"
                            : invoice.status === InvoiceStatus.VOID
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </TableCell>
                    <TableCell align="end">{invoice.totalAmount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrapper>
        )}
      </SectionCard>
      <SectionCard description={t("documents.listHelp")} title={t("labels.documents")}>
        <DocumentList clientId={clientId} queryKey={["client-documents", clientId]} />
      </SectionCard>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">{value ?? "—"}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-2 font-heading text-3xl">{value}</dd>
    </div>
  );
}
