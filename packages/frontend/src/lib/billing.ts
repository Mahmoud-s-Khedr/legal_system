import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BillingSummaryDto,
  CreateExpenseDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  ExpenseListResponseDto,
  InvoiceDto,
  InvoiceListResponseDto,
  UpdateExpenseDto,
  UpdateInvoiceDto
} from "@elms/shared";
import { apiFetch } from "./api";

// ── Invoices ──────────────────────────────────────────────────────────────────

export function useInvoices(filters?: { caseId?: string; clientId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.caseId) params.set("caseId", filters.caseId);
  if (filters?.clientId) params.set("clientId", filters.clientId);
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();

  return useQuery({
    queryKey: ["invoices", filters],
    queryFn: () => apiFetch<InvoiceListResponseDto>(`/api/invoices${qs ? `?${qs}` : ""}`)
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => apiFetch<InvoiceDto>(`/api/invoices/${id}`),
    enabled: !!id
  });
}

export function useCaseBillingSummary(caseId: string) {
  return useQuery({
    queryKey: ["billing-summary", caseId],
    queryFn: () => apiFetch<BillingSummaryDto>(`/api/cases/${caseId}/billing`),
    enabled: !!caseId
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInvoiceDto) =>
      apiFetch<InvoiceDto>("/api/invoices", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] })
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateInvoiceDto) =>
      apiFetch<InvoiceDto>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    }
  });
}

export function useIssueInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<InvoiceDto>(`/api/invoices/${id}/issue`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] })
  });
}

export function useVoidInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<InvoiceDto>(`/api/invoices/${id}/void`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] })
  });
}

export function useAddPayment(invoiceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePaymentDto) =>
      apiFetch<InvoiceDto>(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        body: JSON.stringify(dto)
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
  });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export function useExpenses(filters?: { caseId?: string }) {
  const params = new URLSearchParams();
  if (filters?.caseId) params.set("caseId", filters.caseId);
  const qs = params.toString();

  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: () => apiFetch<ExpenseListResponseDto>(`/api/expenses${qs ? `?${qs}` : ""}`)
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateExpenseDto) =>
      apiFetch<{ id: string }>("/api/expenses", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateExpenseDto) =>
      apiFetch<{ id: string }>(`/api/expenses/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] })
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
  });
}
