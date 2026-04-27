import { InvoiceStatus } from "../enums/index";
import type { ApiListResponse } from "../types/common";

// ── Invoice Item ──────────────────────────────────────────────────────────────

export interface InvoiceItemDto {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface CreateInvoiceItemDto {
  description: string;
  quantity?: number;
  unitPrice: string;
}

// ── Invoice ───────────────────────────────────────────────────────────────────

export interface InvoiceDto {
  id: string;
  firmId: string;
  caseId: string | null;
  caseTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  feeType: string;
  subtotalAmount: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  issuedAt: string | null;
  dueDate: string | null;
  items: InvoiceItemDto[];
  payments: PaymentDto[];
  creditApplications: InvoiceCreditApplicationDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceDto {
  caseId?: string | null;
  clientId?: string | null;
  feeType?: string;
  taxAmount?: string;
  discountAmount?: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  items: CreateInvoiceItemDto[];
}

export interface UpdateInvoiceDto {
  feeType?: string;
  taxAmount?: string;
  discountAmount?: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  items?: CreateInvoiceItemDto[];
}

export type InvoiceListResponseDto = ApiListResponse<InvoiceDto>;

// ── Payment ───────────────────────────────────────────────────────────────────

export interface PaymentDto {
  id: string;
  invoiceId: string;
  amount: string;
  method: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
}

export interface CreatePaymentDto {
  amount: string;
  method: string;
  referenceNumber?: string | null;
  paidAt?: string | null;
}

export interface InvoiceCreditApplicationDto {
  id: string;
  amount: string;
  paymentId: string | null;
  createdAt: string;
}

export interface ClientCreditBalanceDto {
  clientId: string;
  availableAmount: string;
}

export interface ApplyInvoiceCreditDto {
  amount: string;
}

// ── Expense ───────────────────────────────────────────────────────────────────

export interface ExpenseDto {
  id: string;
  firmId: string;
  caseId: string | null;
  caseTitle: string | null;
  category: string;
  amount: string;
  description: string | null;
  receiptDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseDto {
  caseId?: string | null;
  category: string;
  amount: string;
  description?: string | null;
  receiptDocumentId?: string | null;
}

export type UpdateExpenseDto = Partial<CreateExpenseDto>;

export type ExpenseListResponseDto = ApiListResponse<ExpenseDto>;

// ── Billing Summary ───────────────────────────────────────────────────────────

export interface BillingSummaryDto {
  caseId: string;
  totalBilled: string;
  totalPaid: string;
  outstanding: string;
  totalExpenses: string;
  profitability: string;
  invoiceCount: number;
  expenseCount: number;
}
