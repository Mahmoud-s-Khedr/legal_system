import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import {
  useCaseBillingSummary,
  useInvoices,
  useExpenses,
  useCreateExpense,
  useDeleteExpense
} from "../../lib/billing";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormAlert,
  SectionCard,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableWrapper,
  formatCurrency
} from "../../routes/app/ui";
import { getEnumLabel } from "../../lib/enumLabel";
import { useToastStore } from "../../store/toastStore";

export function CaseBillingTab({ caseId }: { caseId: string }) {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const summary = useCaseBillingSummary(caseId);
  const invoices = useInvoices({ caseId });
  const expenses = useExpenses({ caseId });
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      await createExpense.mutateAsync({
        caseId,
        category,
        amount,
        description: description || null
      });
      setCategory("");
      setAmount("");
      setDescription("");
      setShowExpenseForm(false);
    } catch (error) {
      setFormError((error as Error)?.message ?? "Request failed");
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary.isLoading ? (
        <p className="text-sm text-slate-500">{t("labels.loading")}</p>
      ) : summary.isError ? (
        <ErrorState
          title={t("errors.title")}
          description={
            (summary.error as Error)?.message ?? t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void summary.refetch()}
        />
      ) : summary.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            {
              label: t("billing.totalBilled"),
              value: summary.data.totalBilled
            },
            { label: t("billing.totalPaid"), value: summary.data.totalPaid },
            {
              label: t("billing.outstanding"),
              value: summary.data.outstanding
            },
            {
              label: t("billing.totalExpenses"),
              value: summary.data.totalExpenses
            },
            {
              label: t("billing.profitability"),
              value: summary.data.profitability
            }
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-semibold">{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Invoices */}
      <SectionCard title={t("billing.invoices")} description="">
        <div className="mb-3 flex justify-end">
          <Link
            to="/app/invoices/new"
            className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white"
          >
            {t("actions.newInvoice")}
          </Link>
        </div>
        {invoices.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : invoices.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (invoices.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void invoices.refetch()}
          />
        ) : !invoices.data?.items.length ? (
          <EmptyState
            title={t("empty.noInvoices")}
            description={t("empty.noInvoicesHelp")}
          />
        ) : (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("billing.invoice")}</TableHeadCell>
                  <TableHeadCell>{t("labels.status")}</TableHeadCell>
                  <TableHeadCell align="end">
                    {t("billing.amount")}
                  </TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {invoices.data.items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        key={inv.id}
                        to="/app/invoices/$invoiceId"
                        params={{ invoiceId: inv.id }}
                        className="font-medium text-accent hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === InvoiceStatus.PAID
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === InvoiceStatus.VOID
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {getEnumLabel(t, "InvoiceStatus", inv.status)}
                      </span>
                    </TableCell>
                    <TableCell align="end">
                      {formatCurrency(inv.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrapper>
        )}
      </SectionCard>

      {/* Expenses */}
      <SectionCard title={t("billing.expenses")} description="">
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowExpenseForm(true)}
            className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
          >
            {t("billing.logExpense")}
          </button>
        </div>

        {showExpenseForm && (
          <form
            onSubmit={(e) => void handleCreateExpense(e)}
            className="mb-4 space-y-3 rounded-2xl border border-slate-200 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium">
                  {t("billing.category")}
                </label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium">
                  {t("billing.amount")}
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium">
                  {t("billing.description")}
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            {formError ? <FormAlert message={formError} /> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createExpense.isPending}
                className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {t("billing.save")}
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        )}

        {expenses.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : expenses.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (expenses.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void expenses.refetch()}
          />
        ) : !expenses.data?.items.length ? (
          <EmptyState
            title={t("empty.noExpenses")}
            description={t("empty.noExpensesHelp")}
          />
        ) : (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("billing.category")}</TableHeadCell>
                  <TableHeadCell>{t("labels.description")}</TableHeadCell>
                  <TableHeadCell align="end">
                    {t("billing.amount")}
                  </TableHeadCell>
                  <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {expenses.data.items.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{exp.category}</TableCell>
                    <TableCell>{exp.description ?? "—"}</TableCell>
                    <TableCell align="end">
                      {formatCurrency(exp.amount)}
                    </TableCell>
                    <TableCell align="end">
                      <button
                        onClick={() => {
                          void (async () => {
                            try {
                              await deleteExpense.mutateAsync(exp.id);
                            } catch (error) {
                              addToast(
                                (error as Error)?.message ??
                                  t("errors.fallback"),
                                "error"
                              );
                            }
                          })();
                        }}
                        disabled={deleteExpense.isPending}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {t("actions.delete")}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrapper>
        )}
      </SectionCard>
    </div>
  );
}
