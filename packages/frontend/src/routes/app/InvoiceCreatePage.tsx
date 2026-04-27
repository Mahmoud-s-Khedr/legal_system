import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { CaseListResponseDto, ClientListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { toCaseSelectOption, toClientSelectOption } from "../../lib/caseOptions";
import { useMutationFeedback } from "../../lib/feedback";
import { useCreateInvoice } from "../../lib/billing";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import {
  Field,
  FormAlert,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField
} from "./ui";

interface ItemRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDueDateIso(value: string): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  // Store as noon UTC so the calendar date remains stable across timezones.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
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

export function InvoiceCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const feedback = useMutationFeedback();
  const createInvoice = useCreateInvoice();
  const search = useSearch({ strict: false }) as {
    caseId?: string;
    clientId?: string;
  };
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const [caseId, setCaseId] = useState(search.caseId ?? "");
  const [clientId, setClientId] = useState(search.clientId ?? "");
  const [feeType, setFeeType] = useState("FIXED");
  const [taxAmount, setTaxAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const itemCounterRef = useRef(1);
  const [items, setItems] = useState<ItemRow[]>([
    { id: "item-1", description: "", quantity: "1", unitPrice: "0" }
  ]);
  const [error, setError] = useState("");
  useUnsavedChanges(
    Boolean(
      caseId ||
      clientId ||
      feeType !== "FIXED" ||
      dueDate ||
      (parseFloat(taxAmount) || 0) !== 0 ||
      (parseFloat(discountAmount) || 0) !== 0 ||
      items.some(
        (i) => i.description !== "" || i.quantity !== "1" || i.unitPrice !== "0"
      )
    ),
    { bypassBlockRef: bypassRef }
  );

  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases?limit=200")
  });
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiFetch<ClientListResponseDto>("/api/clients?limit=200")
  });

  const caseOptions = useMemo(
    () => [
      { value: "", label: `— ${t("labels.optional")} —` },
      ...((casesQuery.data?.items ?? []).filter(
        (caseItem) => !clientId || caseItem.clientId === clientId
      )).map((caseItem) =>
        toCaseSelectOption(t, caseItem)
      )
    ],
    [casesQuery.data?.items, clientId, t]
  );

  const caseClientById = useMemo(
    () =>
      new Map((casesQuery.data?.items ?? []).map((caseItem) => [caseItem.id, caseItem.clientId])),
    [casesQuery.data?.items]
  );

  useEffect(() => {
    if (!caseId) return;
    const selectedCaseClientId = caseClientById.get(caseId);
    if (!selectedCaseClientId) return;
    if (clientId !== selectedCaseClientId) {
      setClientId(selectedCaseClientId);
    }
  }, [caseClientById, caseId, clientId]);

  const clientOptions = useMemo(
    () => [
      { value: "", label: `— ${t("labels.optional")} —` },
      ...(clientsQuery.data?.items ?? []).map((client) =>
        toClientSelectOption(t, client)
      )
    ],
    [clientsQuery.data?.items, t]
  );

  const subtotal = items.reduce((sum, item) => {
    return (
      sum +
      (parseFloat(item.unitPrice) || 0) * (parseInt(item.quantity, 10) || 0)
    );
  }, 0);
  const totalAmount =
    subtotal + (parseFloat(taxAmount) || 0) - (parseFloat(discountAmount) || 0);

  function addItem() {
    itemCounterRef.current += 1;
    const nextId = `item-${itemCounterRef.current}`;
    setItems((prev) => [
      ...prev,
      { id: nextId, description: "", quantity: "1", unitPrice: "0" }
    ]);
  }

  function handleCaseChange(nextCaseId: string) {
    setCaseId(nextCaseId);
    if (!nextCaseId) return;
    const selectedCaseClientId = caseClientById.get(nextCaseId);
    if (selectedCaseClientId) {
      setClientId(selectedCaseClientId);
    }
  }

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    if (!caseId || !nextClientId) return;
    const selectedCaseClientId = caseClientById.get(caseId);
    if (selectedCaseClientId && selectedCaseClientId !== nextClientId) {
      setCaseId("");
    }
  }

  function handleClearCaseAndClient() {
    setCaseId("");
    setClientId("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedTaxAmount = normalizeMoneyInput(taxAmount);
    if (normalizedTaxAmount === null) {
      setError(t("billing.invalidTaxAmount", "Tax amount must be a valid non-negative number."));
      return;
    }

    const normalizedDiscountAmount = normalizeMoneyInput(discountAmount);
    if (normalizedDiscountAmount === null) {
      setError(t("billing.invalidDiscountAmount", "Discount amount must be a valid non-negative number."));
      return;
    }

    const selectedCaseClientId = caseId ? caseClientById.get(caseId) : null;
    if (caseId && clientId && selectedCaseClientId && selectedCaseClientId !== clientId) {
      setError(
        t(
          "billing.caseClientMismatch",
          "Selected case does not belong to selected client."
        )
      );
      return;
    }

    const normalizedItems = [];
    for (const item of items) {
      const description = item.description.trim();
      const quantity = parsePositiveInteger(item.quantity);
      const unitPrice = normalizeMoneyInput(item.unitPrice);
      if (!description || quantity === null || unitPrice === null) {
        setError(
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
      const invoice = await createInvoice.mutateAsync({
        caseId: caseId || null,
        clientId: clientId || null,
        feeType,
        taxAmount: normalizedTaxAmount,
        discountAmount: normalizedDiscountAmount,
        dueDate: toDueDateIso(dueDate),
        items: normalizedItems
      });
      feedback.success("messages.invoiceCreated");
      allowNextNavigation();
      await navigate({
        to: "/app/invoices/$invoiceId",
        params: { invoiceId: invoice.id }
      });
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
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={handleClearCaseAndClient}
              disabled={!caseId && !clientId}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("actions.clearCaseAndClient")}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={`${t("labels.case")} (${t("labels.optional")})`}
              value={caseId}
              onChange={handleCaseChange}
              options={caseOptions}
            />
            <SelectField
              label={`${t("labels.client")} (${t("labels.optional")})`}
              value={clientId}
              onChange={handleClientChange}
              options={clientOptions}
              disabled={Boolean(caseId)}
              hint={
                caseId
                  ? t(
                      "billing.clientDerivedFromCase",
                      "Client is automatically derived from the selected case."
                    )
                  : undefined
              }
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
                      setDueDate(formatDateInput(d));
                    }}
                  >
                    +{days}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">
                {t("billing.tax")}
              </label>
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
              <label className="block text-sm font-medium">
                {t("billing.discount")}
              </label>
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
                    updateItem(index, "description", e.target.value)
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
                    updateItem(index, "quantity", e.target.value)
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
                    updateItem(index, "unitPrice", e.target.value)
                  }
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
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

        <FormExitActions
          cancelTo="/app/invoices"
          cancelLabel={t("actions.cancel")}
          submitLabel={t("billing.createInvoice")}
          savingLabel={t("labels.saving")}
          submitting={createInvoice.isPending}
        />
      </form>
    </div>
  );
}
