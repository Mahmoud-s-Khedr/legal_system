import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { InvoiceStatus } from "@elms/shared";
import { useInvoice, useIssueInvoice, useVoidInvoice, useAddPayment } from "../../lib/billing";
import { ErrorState, PageHeader, SectionCard, formatCurrency } from "./ui";
import { getEnumLabel } from "../../lib/enumLabel";

export function InvoiceDetailPage() {
  const { invoiceId } = useParams({ from: "/app/invoices/$invoiceId" });
  const { t } = useTranslation("app");
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(invoiceId);

  const issueInvoice = useIssueInvoice(invoiceId);
  const voidInvoice = useVoidInvoice(invoiceId);
  const addPayment = useAddPayment(invoiceId);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentError, setPaymentError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  if (isLoading) return <p className="p-8 text-slate-500">{t("labels.loading")}</p>;
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
  if (!invoice) return <p className="p-8 text-red-500">{t("errors.notFound")}</p>;

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    setPaymentError("");
    try {
      await addPayment.mutateAsync({ amount: paymentAmount, method: paymentMethod });
      setPaymentAmount("");
      setShowPaymentForm(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : t("errors.fallback"));
    }
  }

  const canIssue = invoice.status === InvoiceStatus.DRAFT;
  const canVoid = invoice.status !== InvoiceStatus.VOID;
  const canPay = invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.PARTIALLY_PAID;

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={invoice.invoiceNumber}
        title={invoice.clientName ?? invoice.caseTitle ?? t("billing.invoice")}
        description={`${t("billing.status")}: ${getEnumLabel(t, "InvoiceStatus", invoice.status)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
            >
              {t("billing.downloadPdf")}
            </a>
            {canIssue && (
              <button
                onClick={() => void issueInvoice.mutateAsync()}
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
            {canVoid && (
              <button
                onClick={() => void voidInvoice.mutateAsync()}
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("billing.subtotal"), value: invoice.subtotalAmount },
          { label: t("billing.tax"), value: invoice.taxAmount },
          { label: t("billing.discount"), value: invoice.discountAmount },
          { label: t("billing.total"), value: invoice.totalAmount }
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
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
              <th className="pb-2 text-start">{t("billing.itemDescription")}</th>
              <th className="pb-2 text-center">{t("billing.qty")}</th>
              <th className="pb-2 text-end">{t("billing.unitPrice")}</th>
              <th className="pb-2 text-end">{t("billing.total")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-2">{item.description}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-end">{formatCurrency(item.unitPrice)}</td>
                <td className="py-2 text-end font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {/* Payments */}
      <SectionCard title={t("billing.payments")}>
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-slate-500">{t("billing.noPayments")}</p>
        ) : (
          <div className="space-y-2">
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between text-sm">
                <span>{payment.method} — {new Date(payment.paidAt).toLocaleDateString()}</span>
                <span className="font-semibold text-emerald-700">+{formatCurrency(payment.amount)}</span>
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
                <label className="block text-sm font-medium">{t("billing.amount")}</label>
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
                <label className="block text-sm font-medium">{t("billing.paymentMethod")}</label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
              </div>
            </div>
            {paymentError && (
              <p className="text-sm text-red-600">{paymentError}</p>
            )}
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
      </SectionCard>
    </div>
  );
}
