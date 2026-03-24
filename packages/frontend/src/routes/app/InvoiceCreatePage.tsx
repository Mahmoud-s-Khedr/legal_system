import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCreateInvoice } from "../../lib/billing";
import { PageHeader, SectionCard } from "./ui";

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

export function InvoiceCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [feeType, setFeeType] = useState("FIXED");
  const [taxAmount, setTaxAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ description: "", quantity: "1", unitPrice: "0" }]);
  const [error, setError] = useState("");

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "0" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const invoice = await createInvoice.mutateAsync({
        caseId: caseId || null,
        clientId: clientId || null,
        feeType,
        taxAmount,
        discountAmount,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        items: items.map((item) => ({
          description: item.description,
          quantity: parseInt(item.quantity, 10) || 1,
          unitPrice: item.unitPrice
        }))
      });
      await navigate({ to: "/app/invoices/$invoiceId", params: { invoiceId: invoice.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.fallback"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("billing.newInvoice")}
        description={t("billing.newInvoiceDescription")}
      />

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <SectionCard title={t("billing.invoiceDetails")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">{t("labels.caseId")} ({t("labels.optional")})</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder={t("labels.caseIdPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t("labels.clientId")} ({t("labels.optional")})</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={t("labels.clientIdPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t("billing.feeType")}</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
              >
                <option value="FIXED">{t("billing.feeTypeFixed")}</option>
                <option value="HOURLY">{t("billing.feeTypeHourly")}</option>
                <option value="CONTINGENCY">{t("billing.feeTypeContingency")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">{t("billing.dueDate")}</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t("billing.tax")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">{t("billing.discount")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t("billing.lineItems")}>
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_36px] gap-2 mb-1 text-xs font-medium text-slate-500">
            <span>{t("billing.itemDescription")}</span>
            <span>{t("billing.qty")}</span>
            <span>{t("billing.unitPrice")}</span>
            <span></span>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_80px_100px_36px]">
                <input
                  required
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={t("billing.itemDescription")}
                  value={item.description}
                  onChange={(e) => updateItem(index, "description", e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={t("billing.qty")}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={t("billing.unitPrice")}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="rounded-xl border border-red-200 px-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-accent hover:text-accent"
          >
            + {t("billing.addItem")}
          </button>
        </SectionCard>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createInvoice.isPending}
            className="rounded-2xl bg-accent px-6 py-3 font-semibold text-white disabled:opacity-60"
          >
            {createInvoice.isPending ? t("labels.saving") : t("billing.createInvoice")}
          </button>
        </div>
      </form>
    </div>
  );
}
