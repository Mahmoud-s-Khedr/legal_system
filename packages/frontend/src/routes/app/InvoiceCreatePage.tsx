import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { CaseListResponseDto, ClientListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { useMutationFeedback } from "../../lib/feedback";
import { useCreateInvoice } from "../../lib/billing";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { Field, FormAlert, PageHeader, SectionCard, SelectField } from "./ui";

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

export function InvoiceCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const feedback = useMutationFeedback();
  const createInvoice = useCreateInvoice();
  const search = useSearch({ strict: false }) as { clientId?: string };

  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState(search.clientId ?? "");
  const [feeType, setFeeType] = useState("FIXED");
  const [taxAmount, setTaxAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ description: "", quantity: "1", unitPrice: "0" }]);
  const [error, setError] = useState("");
  useUnsavedChanges(caseId !== "" || clientId !== "" || items.some((i) => i.description !== ""));

  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases?limit=200")
  });
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiFetch<ClientListResponseDto>("/api/clients?limit=200")
  });

  const caseOptions = useMemo(() => [
    { value: "", label: `— ${t("labels.optional")} —` },
    ...(casesQuery.data?.items ?? []).map((c) => ({ value: c.id, label: c.title }))
  ], [casesQuery.data?.items, t]);

  const clientOptions = useMemo(() => [
    { value: "", label: `— ${t("labels.optional")} —` },
    ...(clientsQuery.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
  ], [clientsQuery.data?.items, t]);

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity, 10) || 0);
  }, 0);
  const totalAmount = Math.max(0, subtotal + (parseFloat(taxAmount) || 0) - (parseFloat(discountAmount) || 0));

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
      feedback.success("messages.invoiceCreated");
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
            <SelectField
              label={`${t("labels.case")} (${t("labels.optional")})`}
              value={caseId}
              onChange={setCaseId}
              options={caseOptions}
            />
            <SelectField
              label={`${t("labels.client")} (${t("labels.optional")})`}
              value={clientId}
              onChange={setClientId}
              options={clientOptions}
            />
            <SelectField
              label={t("billing.feeType")}
              value={feeType}
              onChange={setFeeType}
              options={[
                { value: "FIXED", label: t("billing.feeTypeFixed") },
                { value: "HOURLY", label: t("billing.feeTypeHourly") },
                { value: "CONTINGENCY", label: t("billing.feeTypeContingency") }
              ]}
            />
            <div>
              <Field
                label={t("billing.dueDate")}
                type="date"
                commitMode="blur"
                value={dueDate}
                onChange={setDueDate}
              />
              <div className="mt-1 flex gap-2">
                {[15, 30, 60].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-accent hover:text-accent"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setDueDate(d.toISOString().split("T")[0]);
                    }}
                  >
                    +{days}d
                  </button>
                ))}
              </div>
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

          <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{t("billing.subtotal", "Subtotal")}</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t("billing.tax")}</span>
              <span>+{(parseFloat(taxAmount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t("billing.discount")}</span>
              <span>−{(parseFloat(discountAmount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
              <span>{t("billing.total", "Total")}</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </SectionCard>

        {error ? <FormAlert message={error} /> : null}

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
