import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import { useInvoices } from "../../lib/billing";
import { EmptyState, PageHeader, SectionCard, SelectField } from "./ui";

export function InvoicesPage() {
  const { t } = useTranslation("app");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useInvoices(statusFilter ? { status: statusFilter } : undefined);

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

        {!isLoading && !data?.items.length && (
          <div className="mt-4">
            <EmptyState title={t("empty.noInvoices")} description={t("empty.noInvoicesHelp")} />
          </div>
        )}

        {!isLoading && !!data?.items.length && (
          <div className="mt-4 space-y-2">
            {data.items.map((invoice) => (
              <Link
                key={invoice.id}
                to="/app/invoices/$invoiceId"
                params={{ invoiceId: invoice.id }}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent"
              >
                <div>
                  <p className="font-semibold">{invoice.invoiceNumber}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {invoice.clientName ?? invoice.caseTitle ?? "—"}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-semibold">{invoice.totalAmount}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      invoice.status === InvoiceStatus.PAID
                        ? "bg-emerald-100 text-emerald-800"
                        : invoice.status === InvoiceStatus.VOID
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
