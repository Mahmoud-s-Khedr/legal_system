import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";

const ANALYTICS_CASE_REF_PREFIX = "AN-SEED";
const ANALYTICS_TASK_PREFIX = "[AN]";
const ANALYTICS_INVOICE_PREFIX = "AN-INV-";
const ANALYTICS_AUDIT_PREFIX = "analytics.seed.";

function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function daysAhead(days: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export async function refreshDeterministicAnalyticsSeed(prisma: PrismaClient) {
  const firm = await prisma.firm.findFirst({
    where: { slug: "dev-firm", deletedAt: null },
    select: { id: true }
  });

  if (!firm) {
    console.warn("  ⚠ analytics seed skipped: dev-firm not found");
    return;
  }

  const users = await prisma.user.findMany({
    where: { firmId: firm.id, status: "ACTIVE", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 6
  });

  const clients = await prisma.client.findMany({
    where: { firmId: firm.id, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 24
  });

  if (users.length < 3 || clients.length < 8) {
    console.warn("  ⚠ analytics seed skipped: requires at least 3 users and 8 clients in dev-firm");
    return;
  }

  console.log("\n📈 Refreshing deterministic analytics seed...");

  await prisma.payment.deleteMany({
    where: {
      invoice: {
        firmId: firm.id,
        invoiceNumber: { startsWith: ANALYTICS_INVOICE_PREFIX }
      }
    }
  });

  await prisma.invoiceItem.deleteMany({
    where: {
      invoice: {
        firmId: firm.id,
        invoiceNumber: { startsWith: ANALYTICS_INVOICE_PREFIX }
      }
    }
  });

  await prisma.invoice.deleteMany({
    where: {
      firmId: firm.id,
      invoiceNumber: { startsWith: ANALYTICS_INVOICE_PREFIX }
    }
  });

  await prisma.task.deleteMany({
    where: {
      firmId: firm.id,
      title: { startsWith: ANALYTICS_TASK_PREFIX }
    }
  });

  await prisma.caseSession.deleteMany({
    where: {
      case: {
        firmId: firm.id,
        internalRef: { startsWith: ANALYTICS_CASE_REF_PREFIX }
      }
    }
  });

  await prisma.caseAssignment.deleteMany({
    where: {
      assignedCase: {
        firmId: firm.id,
        internalRef: { startsWith: ANALYTICS_CASE_REF_PREFIX }
      }
    }
  });

  await prisma.case.deleteMany({
    where: {
      firmId: firm.id,
      internalRef: { startsWith: ANALYTICS_CASE_REF_PREFIX }
    }
  });

  await prisma.auditLog.deleteMany({
    where: {
      firmId: firm.id,
      action: { startsWith: ANALYTICS_AUDIT_PREFIX }
    }
  });

  const caseStatuses = ["ACTIVE", "ACTIVE", "ACTIVE", "SUSPENDED", "CLOSED", "ACTIVE"] as const;
  const outcomes = [
    "JUDGMENT_ISSUED",
    "POSTPONED_DOCUMENT_SUBMISSION",
    "POSTPONED_REVIEW_MEMO",
    "RESERVED_FOR_JUDGMENT",
    "INTERLOCUTORY_JUDGMENT_ISSUED",
    "POSTPONED_FINAL_PLEADING"
  ] as const;
  const taskStatuses = ["PENDING", "IN_PROGRESS", "DONE", "PENDING", "DONE", "IN_PROGRESS", "CANCELLED"] as const;
  const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  const invoiceStatuses = ["ISSUED", "PARTIALLY_PAID", "PAID", "ISSUED", "PAID", "PARTIALLY_PAID"] as const;

  const createdCases: Array<{ id: string; clientId: string; assignedUserId: string }> = [];

  for (let i = 0; i < 24; i += 1) {
    const user = users[i % users.length];
    const client = clients[i % clients.length];
    const status = caseStatuses[i % caseStatuses.length];

    const created = await prisma.case.create({
      data: {
        id: randomUUID(),
        firmId: firm.id,
        clientId: client.id,
        title: `[AN] Case ${String(i + 1).padStart(2, "0")}`,
        caseNumber: `AN-CASE-${String(i + 1).padStart(3, "0")}`,
        judicialYear: 2026,
        type: "CIVIL",
        status,
        internalRef: `${ANALYTICS_CASE_REF_PREFIX}-${String(i + 1).padStart(3, "0")}`,
        createdAt: daysAgo(90 - i * 3),
        updatedAt: daysAgo(Math.max(1, 45 - i))
      }
    });

    await prisma.caseAssignment.create({
      data: {
        id: randomUUID(),
        caseId: created.id,
        userId: user.id,
        roleOnCase: "LEAD",
        assignedAt: daysAgo(90 - i * 3)
      }
    });

    const teammate = users[(i + 1) % users.length];
    await prisma.caseAssignment.create({
      data: {
        id: randomUUID(),
        caseId: created.id,
        userId: teammate.id,
        roleOnCase: "SUPPORTING",
        assignedAt: daysAgo(80 - i * 2)
      }
    });

    createdCases.push({ id: created.id, clientId: client.id, assignedUserId: user.id });
  }

  let sessionCount = 0;
  for (let i = 0; i < createdCases.length; i += 1) {
    const base = createdCases[i];
    for (let j = 0; j < 4; j += 1) {
      const sessionDaysOffset = 80 - i * 2 - j * 12;
      await prisma.caseSession.create({
        data: {
          id: randomUUID(),
          caseId: base.id,
          assignedLawyerId: users[(i + j) % users.length].id,
          sessionDatetime: sessionDaysOffset > 0 ? daysAgo(sessionDaysOffset, 9 + (j % 5)) : daysAhead(Math.abs(sessionDaysOffset), 9 + (j % 5)),
          outcome: j === 3 ? null : outcomes[(i + j) % outcomes.length],
          notes: `${ANALYTICS_CASE_REF_PREFIX} hearing ${i + 1}-${j + 1}`,
          createdAt: daysAgo(Math.max(1, sessionDaysOffset + 2)),
          updatedAt: daysAgo(Math.max(0, sessionDaysOffset))
        }
      });
      sessionCount += 1;
    }
  }

  let taskCount = 0;
  for (let i = 0; i < createdCases.length; i += 1) {
    const base = createdCases[i];
    for (let j = 0; j < 5; j += 1) {
      const status = taskStatuses[(i + j) % taskStatuses.length];
      const dueDelta = 20 - i - j * 3;
      const dueAt = status === "DONE" ? daysAgo(Math.max(1, dueDelta + 2)) : (dueDelta >= 0 ? daysAhead(dueDelta) : daysAgo(Math.abs(dueDelta)));

      await prisma.task.create({
        data: {
          id: randomUUID(),
          firmId: firm.id,
          caseId: base.id,
          title: `${ANALYTICS_TASK_PREFIX} Task ${String(i + 1).padStart(2, "0")}-${j + 1}`,
          description: "Deterministic analytics task",
          status,
          priority: taskPriorities[(i + j) % taskPriorities.length],
          assignedToId: users[(i + j) % users.length].id,
          createdById: base.assignedUserId,
          dueAt,
          createdAt: daysAgo(85 - i * 2 - j),
          updatedAt: daysAgo(Math.max(0, 30 - i - j))
        }
      });
      taskCount += 1;
    }
  }

  let invoiceCount = 0;
  for (let i = 0; i < createdCases.length; i += 1) {
    const base = createdCases[i];
    const status = invoiceStatuses[i % invoiceStatuses.length];
    const subtotal = 1000 + i * 75;
    const tax = Math.round(subtotal * 0.14);
    const total = subtotal + tax;

    const invoice = await prisma.invoice.create({
      data: {
        id: randomUUID(),
        firmId: firm.id,
        caseId: base.id,
        clientId: base.clientId,
        invoiceNumber: `${ANALYTICS_INVOICE_PREFIX}${String(i + 1).padStart(4, "0")}`,
        status,
        feeType: "FIXED",
        subtotalAmount: subtotal,
        taxAmount: tax,
        discountAmount: 0,
        totalAmount: total,
        issuedAt: daysAgo(70 - i * 2),
        dueDate: daysAgo(40 - i),
        createdAt: daysAgo(70 - i * 2),
        updatedAt: daysAgo(Math.max(0, 15 - i))
      }
    });

    await prisma.invoiceItem.create({
      data: {
        id: randomUUID(),
        invoiceId: invoice.id,
        description: "Deterministic legal service",
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal,
        createdAt: daysAgo(70 - i * 2)
      }
    });

    if (status === "PAID") {
      await prisma.payment.create({
        data: {
          id: randomUUID(),
          invoiceId: invoice.id,
          amount: total,
          method: "BANK_TRANSFER",
          referenceNumber: `AN-PAY-${String(i + 1).padStart(4, "0")}`,
          paidAt: daysAgo(20 - i),
          createdAt: daysAgo(20 - i)
        }
      });
    }

    if (status === "PARTIALLY_PAID") {
      await prisma.payment.create({
        data: {
          id: randomUUID(),
          invoiceId: invoice.id,
          amount: Math.round(total * 0.6),
          method: "INSTAPAY",
          referenceNumber: `AN-PAY-${String(i + 1).padStart(4, "0")}`,
          paidAt: daysAgo(10 - i),
          createdAt: daysAgo(10 - i)
        }
      });
    }

    invoiceCount += 1;
  }

  for (let i = 0; i < 80; i += 1) {
    const caseRef = createdCases[i % createdCases.length];
    const actor = users[i % users.length];
    const action = [
      "analytics.seed.tasks.update",
      "analytics.seed.hearings.update",
      "analytics.seed.invoices.update",
      "analytics.seed.cases.update"
    ][i % 4];

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        firmId: firm.id,
        userId: actor.id,
        action,
        entityType: "Case",
        entityId: caseRef.id,
        createdAt: daysAgo(30 - (i % 30), 8 + (i % 8))
      }
    });
  }

  console.log(`  ✓ analytics cases seeded: ${createdCases.length}`);
  console.log(`  ✓ analytics hearings seeded: ${sessionCount}`);
  console.log(`  ✓ analytics tasks seeded: ${taskCount}`);
  console.log(`  ✓ analytics invoices seeded: ${invoiceCount}`);
  console.log("  ✓ deterministic analytics dataset ready");
}
