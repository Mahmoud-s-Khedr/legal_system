import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InvoiceStatus, type CreatePaymentDto, type InvoiceDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { useInvoices } from "../../lib/billing";
import { useTableQueryState } from "../../lib/tableQueryState";
import { DataTable, EmptyState, ErrorState, Field, PageHeader, SectionCard, SelectField, SortableTableHeadCell, TableBody, TableCell, TableHead, TableHeadCell, TablePagination, TableRow, TableToolbar, TableWrapper, formatCurrency } from "./ui";

export function InvoicesPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const [paymentRowId, setPaymentRowId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentRef, setPaymentRef] = useState("");

  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, dto }: { invoiceId: string; dto: CreatePaymentDto }) =>
      apiFetch<InvoiceDto>(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify(dto)
      }),
    onSuccess: () => {
      setPaymentRowId(null);
      setPaymentAmount("");
      setPaymentRef("");
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  });

  function openPaymentForm(invoice: InvoiceDto) {
    setPaymentRowId(invoice.id);
    setPaymentAmount(invoice.totalAmount);
    setPaymentMethod("CASH");
    setPaymentRef("");
  }

  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["status"]
  });

  const { data, isLoading, isError, error, refetch } = useInvoices({
    q: table.state.q || undefined,
    status: table.state.filters.status || undefined,
    sortBy: table.state.sortBy,
    sortDir: table.state.sortDir,
    page: table.state.page,
    limit: table.state.limit
  });

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
        <TableToolbar>
          <Field
            label={t("labels.search")}
            value={table.state.q}
            onChange={table.setQ}
            placeholder={t("billing.searchPlaceholder")}
          />
          <SelectField
            label={t("labels.status")}
            value={table.state.filters.status ?? ""}
            onChange={(value) => table.setFilter("status", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...Object.values(InvoiceStatus).map((v) => ({ value: v, label: v }))
            ]}
          />
        </TableToolbar>

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
                    <SortableTableHeadCell label={t("billing.invoiceNumber")} sortKey="invoiceNumber" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <TableHeadCell>{t("labels.client")}</TableHeadCell>
                    <SortableTableHeadCell label={t("labels.status")} sortKey="status" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <SortableTableHeadCell label={t("billing.total")} sortKey="totalAmount" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} align="end" />
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.items.map((invoice) => (
                    <Fragment key={invoice.id}>
                      <TableRow>
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
                          <div className="flex items-center justify-end gap-2">
                            {(invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.PARTIALLY_PAID) && (
                              <button
                                className="inline-flex rounded-xl border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                onClick={() => openPaymentForm(invoice)}
                                type="button"
                              >
                                {t("billing.recordPayment")}
                              </button>
                            )}
                            <Link
                              className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              params={{ invoiceId: invoice.id }}
                              to="/app/invoices/$invoiceId"
                            >
                              {t("actions.viewDocument")}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                      {paymentRowId === invoice.id && (
                        <tr>
                          <td className="bg-slate-50 px-4 py-3" colSpan={5}>
                            <form
                              className="flex flex-wrap items-end gap-3"
                              onSubmit={(e) => {
                                e.preventDefault();
                                paymentMutation.mutate({ invoiceId: invoice.id, dto: { amount: paymentAmount, method: paymentMethod, referenceNumber: paymentRef || null } });
                              }}
                            >
                              <div>
                                <label className="block text-xs font-medium text-slate-600">{t("billing.amount")}</label>
                                <input
                                  className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                  min="0.01"
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                                  required
                                  step="0.01"
                                  type="number"
                                  value={paymentAmount}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600">{t("billing.paymentMethod")}</label>
                                <select
                                  className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                  onChange={(e) => setPaymentMethod(e.target.value)}
                                  value={paymentMethod}
                                >
                                  {["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"].map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600">{t("billing.referenceNumber", "Reference")}</label>
                                <input
                                  className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                  onChange={(e) => setPaymentRef(e.target.value)}
                                  placeholder={t("labels.optional")}
                                  type="text"
                                  value={paymentRef}
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                  disabled={paymentMutation.isPending}
                                  type="submit"
                                >
                                  {paymentMutation.isPending ? t("labels.saving") : t("actions.save")}
                                </button>
                                <button
                                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                                  onClick={() => setPaymentRowId(null)}
                                  type="button"
                                >
                                  {t("actions.cancel")}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={data.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
