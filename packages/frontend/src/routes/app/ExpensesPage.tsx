import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { CaseListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { toCaseSelectOption } from "../../lib/caseOptions";
import {
  useExpenses,
  useCreateExpense,
  useDeleteExpense
} from "../../lib/billing";
import { confirmAction } from "../../lib/dialog";
import { useTableQueryState } from "../../lib/tableQueryState";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SectionCard,
  SortableTableHeadCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TablePagination,
  TableRow,
  TableToolbar,
  TableWrapper,
  SelectField,
  formatCurrency
} from "./ui";

export function ExpensesPage() {
  const { t } = useTranslation("app");
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["category"]
  });
  const { data, isLoading, isError, error, refetch } = useExpenses({
    q: table.state.q || undefined,
    category: table.state.filters.category || undefined,
    sortBy: table.state.sortBy,
    sortDir: table.state.sortDir,
    page: table.state.page,
    limit: table.state.limit
  });
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [caseId, setCaseId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases?limit=200")
  });
  const caseOptions = useMemo(() => {
    return (casesQuery.data?.items ?? []).map((c) => toCaseSelectOption(t, c));
  }, [casesQuery.data, t]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    try {
      await createExpense.mutateAsync({
        category,
        amount,
        description: description || null,
        caseId: caseId || null
      });
      setCategory("");
      setAmount("");
      setDescription("");
      setCaseId("");
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
                <label className="block text-sm font-medium">
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
                <label className="block text-sm font-medium">
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
                <SelectField
                  label={`${t("labels.case")} (${t("labels.optional")})`}
                  value={caseId}
                  onChange={setCaseId}
                  options={caseOptions}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium">
                  {t("billing.description")}
                </label>
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
        <TableToolbar>
          <Field
            label={t("labels.search")}
            value={table.state.q}
            onChange={table.setQ}
            placeholder={t("billing.searchPlaceholder")}
          />
          <Field
            label={t("billing.category")}
            value={table.state.filters.category ?? ""}
            onChange={(value) => table.setFilter("category", value)}
            placeholder={t("billing.category")}
          />
        </TableToolbar>
        {isLoading && (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        )}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && !data?.items.length && (
          <EmptyState
            title={t("empty.noExpenses")}
            description={t("empty.noExpensesHelp")}
          />
        )}
        {!isLoading && !isError && !!data?.items.length && (
          <>
            {deleteError ? (
              <p className="text-sm text-red-600">{deleteError}</p>
            ) : null}
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <SortableTableHeadCell
                      label={t("billing.category")}
                      sortKey="category"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <TableHeadCell>{t("labels.description")}</TableHeadCell>
                    <TableHeadCell>{t("labels.case")}</TableHeadCell>
                    <SortableTableHeadCell
                      label={t("billing.amount")}
                      sortKey="amount"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                      align="end"
                    />
                    <TableHeadCell align="end">
                      {t("actions.more")}
                    </TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.items.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>{exp.category}</TableCell>
                      <TableCell>{exp.description ?? "—"}</TableCell>
                      <TableCell>{exp.caseTitle ?? "—"}</TableCell>
                      <TableCell align="end">
                        {formatCurrency(exp.amount)}
                      </TableCell>
                      <TableCell align="end">
                        <button
                          onClick={() => {
                            void (async () => {
                              const approved = await confirmAction({
                                content: t(
                                  "billing.deleteExpenseConfirm",
                                  "Delete this expense?"
                                )
                              });
                              if (!approved) {
                                return;
                              }
                              try {
                                setDeleteError("");
                                await deleteExpense.mutateAsync(exp.id);
                              } catch (error) {
                                setDeleteError(
                                  (error as Error)?.message ??
                                    t("errors.fallback")
                                );
                              }
                            })();
                          }}
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
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={data.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}
