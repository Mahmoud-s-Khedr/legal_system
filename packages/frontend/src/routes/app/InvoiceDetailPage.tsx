import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import {
  useInvoice,
  useIssueInvoice,
  useVoidInvoice,
  useAddPayment,
  useUpdateInvoice,
  useApplyInvoiceCredit,
  useClientCreditBalance
} from "../../lib/billing";
import { apiDownload, apiFetch } from "../../lib/api";
import { formatFileSaveSuccessMessage } from "../../lib/fileSaveFeedback";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
import { confirmAction } from "../../lib/dialog";
import { useLocalizedLookupOptions } from "../../lib/lookups";
import {
  ErrorState,
  FormAlert,
  PageHeader,
  SectionCard,
  formatCurrency,
  formatDate
} from "./ui";
import { getEnumLabel } from "../../lib/enumLabel";
import { useToastStore } from "../../store/toastStore";

interface EditableItemRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function normalizeMoneyInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "0";
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount.toFixed(2);
}

function parsePositiveInteger(value: string): number | null {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  return quantity;
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams({ from: "/app/invoices/$invoiceId" });
  const navigate = useNavigate();
  const { t } = useTranslation("app");
  const {
    data: invoice,
    isLoading,
    isError,
    error,
    refetch
  } = useInvoice(invoiceId);

  const issueInvoice = useIssueInvoice(invoiceId);
  const voidInvoice = useVoidInvoice(invoiceId);
  const addPayment = useAddPayment(invoiceId);
  const updateInvoice = useUpdateInvoice(invoiceId);
  const applyCredit = useApplyInvoiceCredit(invoiceId);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentError, setPaymentError] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditError, setCreditError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [editFeeType, setEditFeeType] = useState("");
  const [editTaxAmount, setEditTaxAmount] = useState("0");
  const [editDiscountAmount, setEditDiscountAmount] = useState("0");
  const [editIssuedAt, setEditIssuedAt] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editItems, setEditItems] = useState<EditableItemRow[]>([]);
  const [editError, setEditError] = useState("");
  const addToast = useToastStore((state) => state.addToast);
  const creditBalance = useClientCreditBalance(invoice?.clientId);
  const paymentMethods = useLocalizedLookupOptions("PaymentMethod");

  if (isLoading)
    return <p className="p-8 text-slate-500">{t("labels.loading")}</p>;
  if (isError) {
    return (
      <div className="p-8">
        <ErrorState
          title={t("errors.title")}
          description={(error as Error)?.message ?? t("errors.fallback")}
          retryLabel={t("errors.reload")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  async function handleApplyCredit(e: React.FormEvent) {
    e.preventDefault();
    setCreditError("");
    try {
      await applyCredit.mutateAsync({ amount: creditAmount });
      addToast(t("messages.creditApplied", "Credit applied"), "success");
      setCreditAmount("");
      setShowCreditForm(false);
    } catch (err) {
      setCreditError(
        err instanceof Error ? err.message : t("errors.fallback")
      );
    }
  }
  if (!invoice)
    return <p className="p-8 text-red-500">{t("errors.notFound")}</p>;
  const currentInvoice = invoice;

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    setPaymentError("");
    try {
      await addPayment.mutateAsync({
        amount: paymentAmount,
        method: paymentMethod
      });
      addToast(t("messages.paymentRecorded"), "success");
      setPaymentAmount("");
      setShowPaymentForm(false);
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : t("errors.fallback")
      );
    }
  }

  const canIssue = invoice.status === InvoiceStatus.DRAFT;
  const canEdit = invoice.status === InvoiceStatus.DRAFT;
  const canDelete = invoice.status === InvoiceStatus.DRAFT;
  const canVoid = invoice.status !== InvoiceStatus.VOID;
  const canPay =
    invoice.status === InvoiceStatus.ISSUED ||
    invoice.status === InvoiceStatus.PARTIALLY_PAID;
  const canApplyCredit =
    canPay &&
    !!invoice.clientId &&
    Number(creditBalance.data?.availableAmount ?? 0) > 0;

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;

  async function handleDownloadPdf() {
    try {
      setIsDownloadingPdf(true);
      const { blob, filename } = await apiDownload(pdfUrl);
      const savedPath = await saveBlobToDownloads(
        blob,
        filename ?? `invoice-${currentInvoice.invoiceNumber}.pdf`
      );
      addToast(formatFileSaveSuccessMessage(t, savedPath), "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("errors.fallback");
      addToast(message, "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function handleDeleteInvoice() {
    const approved = await confirmAction({
      title: t("actions.confirmDelete"),
      content: t("actions.deleteConfirmMessage"),
      okButtonProps: { danger: true }
    });
    if (!approved) return;
    try {
      setActionError("");
      await apiFetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      addToast(t("messages.saved"), "success");
      void navigate({ to: "/app/invoices" });
    } catch (error) {
      setActionError((error as Error)?.message ?? t("errors.fallback"));
    }
  }

  function toDateInputValue(value: string | null) {
    if (!value) return "";
    return value.slice(0, 10);
  }

  function openEditForm() {
    setEditFeeType(currentInvoice.feeType);
    setEditTaxAmount(currentInvoice.taxAmount);
    setEditDiscountAmount(currentInvoice.discountAmount);
    setEditIssuedAt(toDateInputValue(currentInvoice.issuedAt));
    setEditDueDate(toDateInputValue(currentInvoice.dueDate));
    setEditItems(
      currentInvoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: item.unitPrice
      }))
    );
    setEditError("");
    setShowEditForm(true);
  }

  function addEditItem() {
    setEditItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        description: "",
        quantity: "1",
        unitPrice: "0"
      }
    ]);
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEditItem(
    index: number,
    field: keyof EditableItemRow,
    value: string
  ) {
    setEditItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function handleEditInvoice(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    const normalizedTaxAmount = normalizeMoneyInput(editTaxAmount);
    if (normalizedTaxAmount === null) {
      setEditError(
        t("billing.invalidTaxAmount", "Tax amount must be a valid non-negative number.")
      );
      return;
    }
    const normalizedDiscountAmount = normalizeMoneyInput(editDiscountAmount);
    if (normalizedDiscountAmount === null) {
      setEditError(
        t("billing.invalidDiscountAmount", "Discount amount must be a valid non-negative number.")
      );
      return;
    }
    const normalizedItems = [];
    for (const item of editItems) {
      const description = item.description.trim();
      const quantity = parsePositiveInteger(item.quantity);
      const unitPrice = normalizeMoneyInput(item.unitPrice);
      if (!description || quantity === null || unitPrice === null) {
        setEditError(
          t(
            "billing.invalidLineItem",
            "Each line item must have a description, valid quantity, and valid unit price."
          )
        );
        return;
      }
      normalizedItems.push({ description, quantity, unitPrice });
    }
    try {
      await updateInvoice.mutateAsync({
        feeType: editFeeType,
        taxAmount: normalizedTaxAmount,
        discountAmount: normalizedDiscountAmount,
        issuedAt: editIssuedAt ? new Date(editIssuedAt).toISOString() : null,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        items: normalizedItems
      });
      addToast(t("messages.saved"), "success");
      setShowEditForm(false);
    } catch (error) {
      setEditError((error as Error)?.message ?? t("errors.fallback"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={invoice.invoiceNumber}
        title={
          currentInvoice.clientName ??
          currentInvoice.caseTitle ??
          t("billing.invoice")
        }
        description={`${t("billing.status")}: ${getEnumLabel(t, "InvoiceStatus", currentInvoice.status)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={() => {
                void handleDownloadPdf();
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
            >
              {t("billing.downloadPdf")}
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => openEditForm()}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
              >
                {t("actions.edit", "Edit")}
              </button>
            )}
            {canIssue && (
              <button
                onClick={async () => {
                  try {
                    setActionError("");
                    await issueInvoice.mutateAsync();
                    addToast(t("messages.invoiceIssued"), "success");
                  } catch (error) {
                    setActionError(
                      (error as Error)?.message ?? t("errors.fallback")
                    );
                  }
                }}
                disabled={issueInvoice.isPending}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t("billing.issue")}
              </button>
            )}
            {canPay && (
              <button
                onClick={() => setShowPaymentForm(true)}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {t("billing.recordPayment")}
              </button>
            )}
            {canApplyCredit && (
              <button
                onClick={() => setShowCreditForm(true)}
                className="rounded-2xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                {t("billing.applyCredit", "Apply Credit")}
              </button>
            )}
            {canVoid && (
              <button
                onClick={async () => {
                  try {
                    setActionError("");
                    await voidInvoice.mutateAsync();
                    addToast(t("messages.invoiceVoided"), "success");
                  } catch (error) {
                    setActionError(
                      (error as Error)?.message ?? t("errors.fallback")
                    );
                  }
                }}
                disabled={voidInvoice.isPending}
                className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {t("billing.void")}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  void handleDeleteInvoice();
                }}
                className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                type="button"
              >
                {t("actions.delete")}
              </button>
            )}
          </div>
        }
      />

      {/* Totals */}
      {actionError ? <FormAlert message={actionError} /> : null}
      {showEditForm ? (
        <SectionCard title={t("actions.edit", "Edit")}>
          <form onSubmit={(e) => void handleEditInvoice(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.feeType")}
                </label>
                <input
                  required
                  value={editFeeType}
                  onChange={(e) => setEditFeeType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.tax")}
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={editTaxAmount}
                  onChange={(e) => setEditTaxAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.discount")}
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDiscountAmount}
                  onChange={(e) => setEditDiscountAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.issueDate", "Issue date")}
                </label>
                <input
                  type="date"
                  value={editIssuedAt}
                  onChange={(e) => setEditIssuedAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.dueDate")}
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <div className="mb-2 hidden sm:grid sm:grid-cols-[1fr_80px_100px_36px] gap-2 text-xs font-medium text-slate-500">
                <span>{t("billing.itemDescription")}</span>
                <span>{t("billing.qty")}</span>
                <span>{t("billing.unitPrice")}</span>
                <span></span>
              </div>
              <div className="space-y-2">
                {editItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-2 sm:grid-cols-[1fr_80px_100px_36px]"
                  >
                    <input
                      required
                      aria-label={`${t("billing.itemDescription")} ${index + 1}`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder={t("billing.itemDescription")}
                      value={item.description}
                      onChange={(e) =>
                        updateEditItem(index, "description", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      required
                      aria-label={`${t("billing.qty")} ${index + 1}`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder={t("billing.qty")}
                      value={item.quantity}
                      onChange={(e) =>
                        updateEditItem(index, "quantity", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      aria-label={`${t("billing.unitPrice")} ${index + 1}`}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder={t("billing.unitPrice")}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateEditItem(index, "unitPrice", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeEditItem(index)}
                      disabled={editItems.length === 1}
                      aria-label={t("actions.remove", "Remove")}
                      className="rounded-xl border border-red-200 px-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addEditItem}
                className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-accent hover:text-accent"
              >
                + {t("billing.addItem")}
              </button>
            </div>
            {editError ? <FormAlert message={editError} /> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateInvoice.isPending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t("billing.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditForm(false);
                  setEditError("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: t("billing.subtotal"),
            value: currentInvoice.subtotalAmount
          },
          { label: t("billing.tax"), value: currentInvoice.taxAmount },
          {
            label: t("billing.discount"),
            value: currentInvoice.discountAmount
          },
          { label: t("billing.total"), value: currentInvoice.totalAmount },
          {
            label: t("billing.totalPaid"),
            value: currentInvoice.payments.reduce(
              (sum, p) => sum + Number(p.amount),
              0
            ),
            highlight: "text-emerald-600"
          },
          {
            label: t("billing.outstanding"),
            value: Math.max(
              0,
              Number(currentInvoice.totalAmount) -
                currentInvoice.payments.reduce(
                  (sum, p) => sum + Number(p.amount),
                  0
                )
            ),
            highlight: "text-red-600"
          }
        ].map(({ label, value, highlight }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`mt-1 font-semibold ${highlight || ""}`}>
              {formatCurrency(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <SectionCard title={t("billing.lineItems")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="pb-2 text-start">
                {t("billing.itemDescription")}
              </th>
              <th className="pb-2 text-center">{t("billing.qty")}</th>
              <th className="pb-2 text-end">{t("billing.unitPrice")}</th>
              <th className="pb-2 text-end">{t("billing.total")}</th>
            </tr>
          </thead>
          <tbody>
            {currentInvoice.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-end">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="py-2 text-end font-medium">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {/* Payments */}
      <SectionCard title={t("billing.payments")}>
        {invoice.clientId ? (
          <p className="mb-3 text-sm text-slate-600">
            {t("billing.availableClientCredit", "Available client credit")}: {" "}
            <span className="font-semibold">
              {formatCurrency(creditBalance.data?.availableAmount ?? "0.00")}
            </span>
          </p>
        ) : null}
        {currentInvoice.payments.length === 0 ? (
          <p className="text-sm text-slate-500">{t("billing.noPayments")}</p>
        ) : (
          <div className="space-y-2">
            {currentInvoice.payments.map((payment) => {
              const methodLabel = paymentMethods.getLabel(payment.method);
              return (
              <div key={payment.id} className="flex justify-between text-sm">
                <span>
                  <bdi>{methodLabel}</bdi> &bull; <bdi>{formatDate(payment.paidAt)}</bdi>
                </span>
                <span className="font-semibold text-emerald-700">
                  <bdi>+{formatCurrency(payment.amount)}</bdi>
                </span>
              </div>
              );
            })}
          </div>
        )}

        {showPaymentForm && (
          <form
            onSubmit={(e) => void handleAddPayment(e)}
            className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
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
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                {Number(paymentAmount) >
                  Number(currentInvoice.totalAmount) -
                    currentInvoice.payments.reduce(
                      (sum, p) => sum + Number(p.amount),
                      0
                    ) && invoice.clientId ? (
                  <p className="mt-2 text-xs text-sky-700 bg-sky-50 p-2 rounded-lg border border-sky-100">
                    {t(
                      "billing.overpaymentNote",
                      "Note: Excess payment will be added to the client's credit balance."
                    )}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.paymentMethod")}
                </label>
                <select
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={paymentMethods.isLoading}
                >
                  <option value="" disabled>
                    {t("actions.select", "Select")}
                  </option>
                  {paymentMethods.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {paymentError ? <FormAlert message={paymentError} /> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addPayment.isPending}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t("billing.save")}
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        )}

        {showCreditForm && (
          <form
            onSubmit={(e) => void handleApplyCredit(e)}
            className="mt-4 space-y-3 rounded-2xl border border-indigo-200 p-4"
          >
            <div>
              <label className="block text-sm font-medium">
                {t("billing.creditAmount", "Credit Amount")}
              </label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                {t("billing.creditMaxHint", "Max available")}: {" "}
                {formatCurrency(creditBalance.data?.availableAmount ?? "0.00")}
              </p>
            </div>
            {creditError ? <FormAlert message={creditError} /> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={applyCredit.isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {t("actions.apply", "Apply")}
              </button>
              <button
                type="button"
                onClick={() => setShowCreditForm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
