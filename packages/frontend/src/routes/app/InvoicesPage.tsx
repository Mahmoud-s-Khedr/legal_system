import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import { useInvoices } from "../../lib/billing";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, SelectField, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper, formatCurrency } from "./ui";

export function InvoicesPage() {
  const { t } = useTranslation("app");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, isError, error, refetch } = useInvoices(statusFilter ? { status: statusFilter } : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("billing.eyebrow")}
        title={t("billing.invoicesTitle")}
        description={t("billing.invoicesDescription")}
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/invoices/new"
          >
            {t("actions.newInvoice")}
          </Link>
        }
      />

      <SectionCard title={t("billing.invoiceList")}>
        <SelectField
          label={t("labels.status")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "", label: t("labels.all") },
            ...Object.values(InvoiceStatus).map((v) => ({ value: v, label: v }))
          ]}
        />

        {isLoading && <p className="mt-4 text-sm text-slate-500">{t("labels.loading")}</p>}

        {!isLoading && isError && (
          <div className="mt-4">
            <ErrorState
              title={t("errors.title")}
              description={(error as Error)?.message ?? t("errors.fallback")}
              retryLabel={t("errors.reload")}
              onRetry={() => void refetch()}
            />
          </div>
        )}

        {!isLoading && !isError && !data?.items.length && (
          <div className="mt-4">
            <EmptyState title={t("empty.noInvoices")} description={t("empty.noInvoicesHelp")} />
          </div>
        )}

        {!isLoading && !isError && !!data?.items.length && (
          <div className="mt-4">
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("billing.invoiceNumber")}</TableHeadCell>
                    <TableHeadCell>{t("labels.client")}</TableHeadCell>
                    <TableHeadCell>{t("labels.status")}</TableHeadCell>
                    <TableHeadCell align="end">{t("billing.total")}</TableHeadCell>
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.items.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.clientName ?? invoice.caseTitle ?? "—"}</TableCell>
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
                      <TableCell align="end">{formatCurrency(invoice.totalAmount)}</TableCell>
                      <TableCell align="end">
                        <Link
                          to="/app/invoices/$invoiceId"
                          params={{ invoiceId: invoice.id }}
                          className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t("actions.viewDocument")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
