import type { HearingDto, InvoiceDto, TaskDto } from "@elms/shared";

export type CalendarEventSource = "hearing" | "task" | "invoice";

export interface CalendarEvent {
  id: string;
  sourceType: CalendarEventSource;
  at: string;
  title: string;
  subtitle: string;
  link: string;
  linkParams: Record<string, string>;
  assigneeKey: string;
}

function getInvoiceCalendarDate(invoice: InvoiceDto) {
  return invoice.dueDate ?? invoice.issuedAt;
}

export function normalizeHearingEvents(items: HearingDto[]): CalendarEvent[] {
  return items.map((item) => ({
    id: `hearing-${item.id}`,
    sourceType: "hearing",
    at: item.sessionDatetime,
    title: item.caseTitle,
    subtitle: item.assignedLawyerName ?? "Unassigned",
    link: "/app/hearings/$hearingId/edit",
    linkParams: { hearingId: item.id },
    assigneeKey: item.assignedLawyerId ?? "unassigned"
  }));
}

export function normalizeTaskEvents(items: TaskDto[]): CalendarEvent[] {
  return items
    .filter((item) => item.dueAt)
    .map((item) => ({
      id: `task-${item.id}`,
      sourceType: "task",
      at: item.dueAt!,
      title: item.title,
      subtitle: item.assignedToName ?? "Unassigned",
      link: "/app/tasks/$taskId",
      linkParams: { taskId: item.id },
      assigneeKey: item.assignedToId ?? "unassigned"
    }));
}

export function normalizeInvoiceEvents(items: InvoiceDto[]): CalendarEvent[] {
  return items
    .filter((item) => Boolean(getInvoiceCalendarDate(item)))
    .map((item) => ({
      id: `invoice-${item.id}`,
      sourceType: "invoice",
      at: getInvoiceCalendarDate(item)!,
      title: item.invoiceNumber,
      subtitle: item.clientName ?? item.caseTitle ?? "Invoice",
      link: "/app/invoices/$invoiceId",
      linkParams: { invoiceId: item.id },
      assigneeKey: "finance"
    }));
}
