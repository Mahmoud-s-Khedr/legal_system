import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import { useInvoices } from "../../lib/billing";
import { useTableQueryState } from "../../lib/tableQueryState";
import { DataTable, EmptyState, ErrorState, Field, PageHeader, SectionCard, SelectField, SortableTableHeadCell, TableBody, TableCell, TableHead, TableHeadCell, TablePagination, TableRow, TableToolbar, TableWrapper, formatCurrency } from "./ui";

export function InvoicesPage() {
  const { t } = useTranslation("app");
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
