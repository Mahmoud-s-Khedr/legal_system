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
import { EmptyState, SectionCard, formatCurrency } from "../../routes/app/ui";
import { getEnumLabel } from "../../lib/enumLabel";

export function CaseBillingTab({ caseId }: { caseId: string }) {
  const { t } = useTranslation("app");
  const summary = useCaseBillingSummary(caseId);
  const invoices = useInvoices({ caseId });
  const expenses = useExpenses({ caseId });
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    await createExpense.mutateAsync({ caseId, category, amount, description: description || null });
    setCategory("");
    setAmount("");
    setDescription("");
    setShowExpenseForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: t("billing.totalBilled"), value: summary.data.totalBilled },
            { label: t("billing.totalPaid"), value: summary.data.totalPaid },
            { label: t("billing.outstanding"), value: summary.data.outstanding },
            { label: t("billing.totalExpenses"), value: summary.data.totalExpenses },
            { label: t("billing.profitability"), value: summary.data.profitability }
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-semibold">{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Invoices */}
      <SectionCard
        title={t("billing.invoices")}
        description=""
      >
        <div className="mb-3 flex justify-end">
          <Link
            to="/app/invoices/new"
            className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white"
          >
            {t("actions.newInvoice")}
          </Link>
        </div>
        {!invoices.data?.items.length ? (
          <EmptyState title={t("empty.noInvoices")} description={t("empty.noInvoicesHelp")} />
        ) : (
          <div className="space-y-2">
            {invoices.data.items.map((inv) => (
              <Link
                key={inv.id}
                to="/app/invoices/$invoiceId"
                params={{ invoiceId: inv.id }}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm hover:border-accent"
              >
                <span>{inv.invoiceNumber}</span>
                <div className="flex items-center gap-2">
                  <span>{formatCurrency(inv.totalAmount)}</span>
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
                </div>
              </Link>
            ))}
          </div>
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
                <label className="block text-xs font-medium">{t("billing.category")}</label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium">{t("billing.amount")}</label>
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
                <label className="block text-xs font-medium">{t("billing.description")}</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
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

        {!expenses.data?.items.length ? (
          <EmptyState title={t("empty.noExpenses")} description={t("empty.noExpensesHelp")} />
        ) : (
          <div className="space-y-2">
            {expenses.data.items.map((exp) => (
              <div
                key={exp.id}
                className="flex items-start justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{exp.category}</p>
                  {exp.description && <p className="text-xs text-slate-500">{exp.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(exp.amount)}</span>
                  <button
                    onClick={() => void deleteExpense.mutateAsync(exp.id)}
                    disabled={deleteExpense.isPending}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50"
                  >
                    {t("actions.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
