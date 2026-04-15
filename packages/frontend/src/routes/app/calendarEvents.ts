import type { HearingDto, InvoiceDto, TaskDto } from "@elms/shared";

export type CalendarEventSource = "hearing" | "task" | "invoice";
export type CalendarMobileMode = "agenda" | "timeline";

export interface CalendarEvent {
  id: string;
  sourceId: string;
  sourceType: CalendarEventSource;
  at: string;
  title: string;
  subtitle: string;
  link: string;
  linkParams: Record<string, string>;
  assigneeKey: string;
  durationMinutes: number;
  editable: {
    hearing?: Pick<HearingDto, "caseId" | "assignedLawyerId" | "nextSessionAt" | "outcome" | "notes">;
    task?: Pick<TaskDto, "caseId" | "title" | "description" | "status" | "priority" | "assignedToId">;
    invoice?: Pick<InvoiceDto, "feeType" | "taxAmount" | "discountAmount">;
  };
}

function getInvoiceCalendarDate(invoice: InvoiceDto) {
  return invoice.dueDate ?? invoice.issuedAt;
}

export function normalizeHearingEvents(items: HearingDto[]): CalendarEvent[] {
  return items.map((item) => ({
    id: `hearing-${item.id}`,
    sourceId: item.id,
    sourceType: "hearing",
    at: item.sessionDatetime,
    title: item.caseTitle,
    subtitle: item.assignedLawyerName ?? "Unassigned",
    link: "/app/hearings/$hearingId/edit",
    linkParams: { hearingId: item.id },
    assigneeKey: item.assignedLawyerId ?? "unassigned",
    durationMinutes: 60,
    editable: {
      hearing: {
        caseId: item.caseId,
        assignedLawyerId: item.assignedLawyerId,
        nextSessionAt: item.nextSessionAt,
        outcome: item.outcome,
        notes: item.notes
      }
    }
  }));
}

export function normalizeTaskEvents(items: TaskDto[]): CalendarEvent[] {
  return items
    .filter((item) => item.dueAt)
    .map((item) => ({
      id: `task-${item.id}`,
      sourceId: item.id,
      sourceType: "task",
      at: item.dueAt!,
      title: item.title,
      subtitle: item.assignedToName ?? "Unassigned",
      link: "/app/tasks/$taskId",
      linkParams: { taskId: item.id },
      assigneeKey: item.assignedToId ?? "unassigned",
      durationMinutes: 30,
      editable: {
        task: {
          caseId: item.caseId,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          assignedToId: item.assignedToId
        }
      }
    }));
}

export function normalizeInvoiceEvents(items: InvoiceDto[]): CalendarEvent[] {
  return items
    .filter((item) => Boolean(getInvoiceCalendarDate(item)))
    .map((item) => ({
      id: `invoice-${item.id}`,
      sourceId: item.id,
      sourceType: "invoice",
      at: getInvoiceCalendarDate(item)!,
      title: item.invoiceNumber,
      subtitle: item.clientName ?? item.caseTitle ?? "Invoice",
      link: "/app/invoices/$invoiceId",
      linkParams: { invoiceId: item.id },
      assigneeKey: "finance",
      durationMinutes: 30,
      editable: {
        invoice: {
          feeType: item.feeType,
          taxAmount: item.taxAmount,
          discountAmount: item.discountAmount
        }
      }
    }));
}

export function getEventDayKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function applyEventFilters(
  items: CalendarEvent[],
  filters: { visibleTypes: CalendarEventSource[]; assignee: string }
) {
  return items.filter((item) => {
    if (!filters.visibleTypes.includes(item.sourceType)) {
      return false;
    }
    if (filters.assignee !== "all" && item.assigneeKey !== filters.assignee) {
      return false;
    }
    return true;
  });
}
