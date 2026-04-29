import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { ClientDto } from "@elms/shared";
import { InvoiceStatus, isValidPhoneNumber, normalizePhoneNumber } from "@elms/shared";
import { InlineEditField } from "../../components/InlineEditField";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useState } from "react";
import { getEnumLabel } from "../../lib/enumLabel";
import { EnumBadge } from "../../components/shared/EnumBadge";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableWrapper,
  formatCurrency
} from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { useClientCreditBalance, useInvoices } from "../../lib/billing";

const PHONE_ERROR = "Enter a valid phone number";

export function ClientDetailPage() {
  const { t } = useTranslation("app");
  const { clientId } = useParams({ from: "/app/clients/$clientId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => apiFetch<ClientDto>(`/api/clients/${clientId}`)
  });
  const clientCreditBalanceQuery = useClientCreditBalance(clientId);
  const invoicesQuery = useInvoices({ clientId });
  const linkedCasesQuery = useQuery({
    queryKey: ["client-cases", clientId],
    queryFn: () =>
      apiFetch<Array<{ id: string; title: string; caseNumber: string; status: string }>>(
        `/api/clients/${clientId}/cases`
      )
  });

  async function patchClient(field: "email" | "phone", value: string) {
    if (field === "phone") {
      const normalized = normalizePhoneNumber(value);
      if (normalized && !isValidPhoneNumber(normalized)) {
        throw new Error(PHONE_ERROR);
      }
      value = normalized;
    }
    const current = await queryClient.fetchQuery({
      queryKey: ["client", clientId],
      queryFn: () => apiFetch<ClientDto>(`/api/clients/${clientId}`)
    });
    await apiFetch(`/api/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: current.name,
        type: current.type,
        phone: field === "phone" ? value || null : current.phone,
        email: field === "email" ? value || null : current.email,
        governorate: current.governorate,
        preferredLanguage: current.preferredLanguage,
        nationalId: current.nationalId,
        commercialRegister: current.commercialRegister,
        taxNumber: current.taxNumber,
        poaNumber: current.poaNumber,
        contacts: current.contacts ?? []
      })
    });
    await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
  }

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/clients/${clientId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void navigate({ to: "/app/clients" });
    }
  });

  const client = clientQuery.data;
  const availableCreditText = clientCreditBalanceQuery.isLoading
    ? t("labels.loading")
    : clientCreditBalanceQuery.isError
      ? "—"
      : formatCurrency(Number(clientCreditBalanceQuery.data?.availableAmount ?? 0));

  if (clientQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (clientQuery.isError) {
    return (
      <ErrorState
        title={t("errors.title")}
        description={
          (clientQuery.error as Error)?.message ?? t("errors.fallback")
        }
        retryLabel={t("errors.reload")}
        onRetry={() => void clientQuery.refetch()}
      />
    );
  }

  if (!client) {
    return (
      <EmptyState
        title={t("empty.noClientSelected")}
        description={t("empty.noClientSelectedHelp")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.profileEyebrow")}
        title={client.name}
        description={client.email ?? t("labels.noContact")}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 lg:w-auto">
            <EnumBadge enumName="ClientType" value={client.type} />
            <Link
              className="rounded-2xl border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5 sm:px-4 sm:py-2.5"
              search={{ clientId }}
              to="/app/cases/quick-new"
            >
              {t("actions.quickIntake")}
            </Link>
            <Link
              className="rounded-2xl border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5 sm:px-4 sm:py-2.5"
              search={{ clientId }}
              to="/app/cases/new"
            >
              {t("actions.newCase")}
            </Link>
            <Link
              className="rounded-2xl border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5 sm:px-4 sm:py-2.5"
              search={{ clientId }}
              to="/app/invoices/new"
            >
              {t("actions.newInvoice")}
            </Link>
            <Link
              className="rounded-2xl bg-accent px-3 py-2 text-sm font-semibold text-white sm:px-4 sm:py-3"
              params={{ clientId }}
              to="/app/clients/$clientId/edit"
            >
              {t("clients.editTitle")}
            </Link>
            <button
              className="rounded-2xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 sm:px-4 sm:py-2.5"
              onClick={() => setShowDeleteConfirm(true)}
              type="button"
            >
              {t("actions.delete")}
            </button>
          </div>
        }
      />
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="font-semibold">{t("actions.confirmDelete")}</p>
            <p className="mt-2 text-sm text-slate-500">{t("actions.deleteConfirmMessage")}</p>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                type="button"
              >
                {t("actions.delete")}
              </button>
              <button
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold"
                onClick={() => setShowDeleteConfirm(false)}
                type="button"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        <SectionCard
          title={t("clients.profile")}
          description={t("clients.profileHelp")}
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500">
                {t("labels.email")}
              </dt>
              <dd className="mt-0.5">
                <InlineEditField
                  onSave={(v) => patchClient("email", v)}
                  placeholder={t("labels.noContact")}
                  value={client.email}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">
                {t("labels.phone")}
              </dt>
              <dd className="mt-0.5">
                <InlineEditField
                  autoComplete="tel"
                  dir="ltr"
                  onSave={(v) => patchClient("phone", v)}
                  inputMode="tel"
                  placeholder="—"
                  value={client.phone}
                />
              </dd>
            </div>
            <Detail
              label={t("labels.governorate")}
              value={client.governorate}
            />
            <Detail
              label={t("labels.language")}
              value={getEnumLabel(t, "Language", client.preferredLanguage)}
            />
            {client.poaNumber ? (
              <Detail
                label={t("labels.poaNumber")}
                value={client.poaNumber}
              />
            ) : null}
            {client.internalRef ? (
              <Detail
                label={t("labels.internalRef")}
                value={client.internalRef}
              />
            ) : null}
          </dl>
        </SectionCard>
        <SectionCard
          title={t("clients.linkedSummary")}
          description={t("clients.linkedSummaryHelp")}
        >
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={t("labels.cases")} value={client.linkedCaseCount} />
            <Metric label={t("labels.invoices")} value={client.invoiceCount} />
            <Metric
              label={t("labels.documents")}
              value={client.documentCount}
            />
            <Metric
              label={t("billing.availableClientCredit")}
              value={availableCreditText}
              className="sm:col-span-2 lg:col-span-4 xl:col-span-2"
              valueClassName="text-2xl sm:text-3xl"
            />
          </dl>
        </SectionCard>
        <SectionCard
          title={t("clients.contacts")}
          description={t("clients.contactsHelp")}
        >
          {!client.contacts.length ? (
            <EmptyState
              title={t("empty.noContacts")}
              description={t("empty.noContactsHelp")}
            />
          ) : (
            <div className="space-y-3">
              {client.contacts.map((contact) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                  key={contact.id}
                >
                  <p className="font-semibold">{contact.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                  <bdi className="inline-block whitespace-nowrap" dir="ltr">
                    {contact.phone}
                  </bdi>
                  {" · "}
                  {contact.email ?? t("labels.noEmail")}
                </p>
              </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <SectionCard
        title={t("labels.invoices")}
        description={t("billing.invoicesDescription")}
      >
        {invoicesQuery.isLoading && (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        )}
        {!invoicesQuery.isLoading && invoicesQuery.isError && (
          <ErrorState
            title={t("errors.title")}
            description={
              (invoicesQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void invoicesQuery.refetch()}
          />
        )}
        {!invoicesQuery.isLoading &&
          !invoicesQuery.isError &&
          !invoicesQuery.data?.items.length && (
            <EmptyState
              title={t("empty.noInvoices")}
              description={t("empty.noInvoicesHelp")}
            />
          )}
        {!invoicesQuery.isLoading &&
          !invoicesQuery.isError &&
          !!invoicesQuery.data?.items.length && (
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("billing.invoice")}</TableHeadCell>
                    <TableHeadCell>{t("labels.case")}</TableHeadCell>
                    <TableHeadCell>{t("labels.status")}</TableHeadCell>
                    <TableHeadCell align="end">
                      {t("billing.amount")}
                    </TableHeadCell>
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
      <SectionCard
        title={t("cases.linkedCases")}
        description={t("cases.linkedCasesHelp")}
      >
        {linkedCasesQuery.isLoading && (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        )}
        {!linkedCasesQuery.isLoading && !linkedCasesQuery.data?.length && (
          <EmptyState
            title={t("empty.noLinkedCases")}
            description={t("empty.noLinkedCasesHelp")}
          />
        )}
        {!linkedCasesQuery.isLoading && !!linkedCasesQuery.data?.length && (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("labels.caseTitle")}</TableHeadCell>
                  <TableHeadCell>{t("labels.status")}</TableHeadCell>
                  <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {linkedCasesQuery.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{`${c.title} (${c.caseNumber})`}</TableCell>
                    <TableCell>
                      <EnumBadge enumName="CaseStatus" value={c.status} />
                    </TableCell>
                    <TableCell align="end">
                      <Link
                        className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        params={{ caseId: c.id }}
                        to="/app/cases/$caseId"
                      >
                        {t("actions.view")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrapper>
        )}
      </SectionCard>
      <SectionCard
        description={t("documents.listHelp")}
        title={t("labels.documents")}
      >
        <DocumentList
          clientId={clientId}
          queryKey={["client-documents", clientId]}
        />
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

function Metric({
  label,
  value,
  className = "",
  valueClassName = "text-3xl"
}: {
  label: string;
  value: string | number;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 ${className}`.trim()}>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`mt-2 min-w-0 font-heading leading-tight ${valueClassName}`}>
        <bdi className="block break-words">{value}</bdi>
      </dd>
    </div>
  );
}
