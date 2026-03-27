import { describe, expect, it } from "vitest";
import { normalizeHearingEvents, normalizeInvoiceEvents, normalizeTaskEvents } from "./calendarEvents";

describe("calendar event normalization", () => {
  it("normalizes hearings", () => {
    const events = normalizeHearingEvents([
      {
        id: "h1",
        caseId: "c1",
        caseTitle: "Case A",
        assignedLawyerId: null,
        assignedLawyerName: null,
        sessionDatetime: "2026-03-27T10:00:00.000Z",
        nextSessionAt: null,
        outcome: null,
        notes: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z"
      }
    ]);

    expect(events[0]).toMatchObject({
      id: "hearing-h1",
      sourceType: "hearing",
      at: "2026-03-27T10:00:00.000Z"
    });
  });

  it("normalizes tasks with due dates only", () => {
    const events = normalizeTaskEvents([
      {
        id: "t1",
        caseId: null,
        caseTitle: null,
        title: "Task 1",
        description: null,
        status: "PENDING",
        priority: "MEDIUM",
        assignedToId: null,
        assignedToName: null,
        createdById: null,
        createdByName: null,
        dueAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z"
      },
      {
        id: "t2",
        caseId: null,
        caseTitle: null,
        title: "Task 2",
        description: null,
        status: "PENDING",
        priority: "MEDIUM",
        assignedToId: null,
        assignedToName: null,
        createdById: null,
        createdByName: null,
        dueAt: "2026-03-28T10:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z"
      }
    ] as never);

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("task-t2");
  });

  it("uses invoice due date fallback to issued date", () => {
    const events = normalizeInvoiceEvents([
      {
        id: "i1",
        firmId: "f1",
        caseId: null,
        caseTitle: null,
        clientId: null,
        clientName: null,
        invoiceNumber: "INV-1",
        status: "DRAFT",
        feeType: "FIXED",
        subtotalAmount: "10.00",
        taxAmount: "0.00",
        discountAmount: "0.00",
        totalAmount: "10.00",
        issuedAt: "2026-03-27T10:00:00.000Z",
        dueDate: null,
        items: [],
        payments: [],
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z"
      }
    ] as never);

    expect(events[0].at).toBe("2026-03-27T10:00:00.000Z");
  });
});
