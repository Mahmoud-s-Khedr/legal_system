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

export function useInvoices(filters?: {
  q?: string;
  caseId?: string;
  clientId?: string;
  status?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  if (filters?.caseId) params.set("caseId", filters.caseId);
  if (filters?.clientId) params.set("clientId", filters.clientId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortDir) params.set("sortDir", filters.sortDir);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateInvoiceDto) =>
      apiFetch<InvoiceDto>(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
  });
}

export function useIssueInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<InvoiceDto>(`/api/invoices/${id}/issue`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
  });
}

export function useVoidInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<InvoiceDto>(`/api/invoices/${id}/void`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
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

export function useExpenses(filters?: {
  q?: string;
  caseId?: string;
  category?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.q) params.set("q", filters.q);
  if (filters?.caseId) params.set("caseId", filters.caseId);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortDir) params.set("sortDir", filters.sortDir);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["billing-summary"] });
    }
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
