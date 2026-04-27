import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import {
  useInvoice,
  useIssueInvoice,
  useVoidInvoice,
  useAddPayment,
  useApplyInvoiceCredit,
  useClientCreditBalance
} from "../../lib/billing";
import { apiDownload } from "../../lib/api";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
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

export function InvoiceDetailPage() {
  const { invoiceId } = useParams({ from: "/app/invoices/$invoiceId" });
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
  const applyCredit = useApplyInvoiceCredit(invoiceId);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentError, setPaymentError] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditError, setCreditError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const creditBalance = useClientCreditBalance(invoice?.clientId);

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
      await saveBlobToDownloads(
        blob,
        filename ?? `invoice-${currentInvoice.invoiceNumber}.pdf`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("errors.fallback");
      addToast(message, "error");
    } finally {
      setIsDownloadingPdf(false);
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
          </div>
        }
      />

      {/* Totals */}
      {actionError ? <FormAlert message={actionError} /> : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          { label: t("billing.total"), value: currentInvoice.totalAmount }
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 font-semibold">{formatCurrency(value)}</p>
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
            {currentInvoice.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between text-sm">
                <span>
                  {payment.method} — {formatDate(payment.paidAt)}
                </span>
                <span className="font-semibold text-emerald-700">
                  +{formatCurrency(payment.amount)}
                </span>
              </div>
            ))}
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
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("billing.paymentMethod")}
                </label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
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
