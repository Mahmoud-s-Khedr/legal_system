import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useExpenses, useCreateExpense, useDeleteExpense } from "../../lib/billing";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper, formatCurrency } from "./ui";

export function ExpensesPage() {
  const { t } = useTranslation("app");
  const { data, isLoading, isError, error, refetch } = useExpenses();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      await createExpense.mutateAsync({ category, amount, description: description || null });
      setCategory("");
      setAmount("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("errors.fallback"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("billing.eyebrow")}
        title={t("billing.expensesTitle")}
        description={t("billing.expensesDescription")}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
          >
            {t("billing.logExpense")}
          </button>
        }
      />

      {showForm && (
        <SectionCard title={t("billing.newExpense")}>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">{t("billing.category")}</label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">{t("billing.amount")}</label>
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
                <label className="block text-sm font-medium">{t("billing.description")}</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createExpense.isPending}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t("billing.save")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title={t("billing.expenseList")}>
        {isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && !data?.items.length && (
          <EmptyState title={t("empty.noExpenses")} description={t("empty.noExpensesHelp")} />
        )}
        {!isLoading && !isError && !!data?.items.length && (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("billing.category")}</TableHeadCell>
                  <TableHeadCell>{t("labels.description")}</TableHeadCell>
                  <TableHeadCell>{t("labels.case")}</TableHeadCell>
                  <TableHeadCell align="end">{t("billing.amount")}</TableHeadCell>
                  <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.items.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{exp.category}</TableCell>
                    <TableCell>{exp.description ?? "—"}</TableCell>
                    <TableCell>{exp.caseTitle ?? "—"}</TableCell>
                    <TableCell align="end">{formatCurrency(exp.amount)}</TableCell>
                    <TableCell align="end">
                      <button
                        onClick={() => void deleteExpense.mutateAsync(exp.id)}
                        disabled={deleteExpense.isPending}
                        className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
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
