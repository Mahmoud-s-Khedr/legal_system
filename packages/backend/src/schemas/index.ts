/**
 * Reusable Fastify JSON Schema response definitions.
 * Using additionalProperties: false ensures Fastify's fast-json-stringify
 * strips any extra fields (e.g. passwordHash) before sending the response.
 */

// ── Primitives ───────────────────────────────────────────────────────────────

export const successSchema = {
  type: "object",
  properties: { success: { type: "boolean", enum: [true] } },
  required: ["success"],
  additionalProperties: false
} as const;

export const errorSchema = {
  type: "object",
  properties: { message: { type: "string" }, code: { type: "string" } },
  required: ["message"],
  additionalProperties: false
} as const;

// ── Auth ─────────────────────────────────────────────────────────────────────

export const sessionUserSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: "string" },
    editionKey: { type: "string" },
    pendingEditionKey: { type: ["string", "null"] },
    lifecycleStatus: { type: "string" },
    trialEndsAt: { type: ["string", "null"] },
    graceEndsAt: { type: ["string", "null"] },
    roleId: { type: "string" },
    roleKey: { type: "string" },
    email: { type: "string" },
    fullName: { type: "string" },
    preferredLanguage: { type: "string" },
    permissions: { type: "array", items: { type: "string" } }
  },
  required: ["id", "firmId", "editionKey", "pendingEditionKey", "lifecycleStatus", "trialEndsAt", "graceEndsAt", "roleId", "roleKey", "email", "fullName", "preferredLanguage", "permissions"],
  additionalProperties: false
} as const;

export const appSessionSchema = {
  type: "object",
  properties: {
    mode: { type: "string" },
    user: { anyOf: [sessionUserSchema, { type: "null" }] }
  },
  required: ["mode", "user"],
  additionalProperties: false
} as const;

export const authResponseSchema = {
  type: "object",
  properties: {
    session: appSessionSchema,
    localSessionToken: { anyOf: [{ type: "string" }, { type: "null" }] }
  },
  required: ["session"],
  additionalProperties: false
} as const;

// ── Pagination helper ─────────────────────────────────────────────────────────

export function listResponseSchema(itemSchema: object) {
  return {
    type: "object",
    properties: {
      items: { type: "array", items: itemSchema },
      total: { type: "number" },
      page: { type: "number" },
      pageSize: { type: "number" }
    },
    required: ["items", "total", "page", "pageSize"],
    additionalProperties: false
  } as const;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const userDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: "string" },
    roleId: { type: "string" },
    roleKey: { type: "string" },
    email: { type: "string" },
    fullName: { type: "string" },
    preferredLanguage: { type: "string" },
    status: { type: "string" },
    permissions: { type: "array", items: { type: "string" } },
    createdAt: { type: "string" }
  },
  required: ["id", "firmId", "roleId", "roleKey", "email", "fullName", "preferredLanguage", "status", "permissions", "createdAt"],
  additionalProperties: false
} as const;

// ── Clients ───────────────────────────────────────────────────────────────────

const clientContactSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    phone: { type: "string" },
    email: { type: ["string", "null"] },
    role: { type: ["string", "null"] }
  },
  required: ["id", "name", "phone", "email", "role"],
  additionalProperties: false
} as const;

export const clientDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    type: { type: "string" },
    phone: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    governorate: { type: ["string", "null"] },
    preferredLanguage: { type: "string" },
    nationalId: { type: ["string", "null"] },
    commercialRegister: { type: ["string", "null"] },
    taxNumber: { type: ["string", "null"] },
    poaNumber: { type: ["string", "null"] },
    contacts: { type: "array", items: clientContactSchema },
    linkedCaseCount: { type: "number" },
    invoiceCount: { type: "number" },
    documentCount: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "name", "type", "preferredLanguage", "contacts", "linkedCaseCount", "invoiceCount", "documentCount", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

// ── Cases ─────────────────────────────────────────────────────────────────────

const caseAssignmentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    userName: { type: "string" },
    roleOnCase: { type: "string" },
    assignedAt: { type: "string" },
    unassignedAt: { type: ["string", "null"] }
  },
  required: ["id", "userId", "userName", "roleOnCase", "assignedAt", "unassignedAt"],
  additionalProperties: false
} as const;

const casePartySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    clientId: { type: ["string", "null"] },
    name: { type: "string" },
    role: { type: "string" },
    partyType: { type: "string" }
  },
  required: ["id", "clientId", "name", "role", "partyType"],
  additionalProperties: false
} as const;

const caseStatusHistorySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    fromStatus: { type: ["string", "null"] },
    toStatus: { type: "string" },
    changedAt: { type: "string" },
    note: { type: ["string", "null"] }
  },
  required: ["id", "fromStatus", "toStatus", "changedAt", "note"],
  additionalProperties: false
} as const;

const caseCourtSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    caseId: { type: "string" },
    courtName: { type: "string" },
    courtLevel: { type: "string" },
    circuit: { type: ["string", "null"] },
    caseNumber: { type: ["string", "null"] },
    stageOrder: { type: "number" },
    startedAt: { type: ["string", "null"] },
    endedAt: { type: ["string", "null"] },
    isActive: { type: "boolean" },
    notes: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "caseId", "courtName", "courtLevel", "stageOrder", "isActive", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

export const caseDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    clientId: { type: ["string", "null"] },
    title: { type: "string" },
    caseNumber: { type: "string" },
    internalReference: { type: ["string", "null"] },
    judicialYear: { type: ["number", "null"] },
    type: { type: "string" },
    status: { type: "string" },
    courts: { type: "array", items: caseCourtSchema },
    assignments: { type: "array", items: caseAssignmentSchema },
    parties: { type: "array", items: casePartySchema },
    statusHistory: { type: "array", items: caseStatusHistorySchema },
    hearingCount: { type: "number" },
    taskCount: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "title", "caseNumber", "status", "courts", "assignments", "parties", "statusHistory", "hearingCount", "taskCount", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

// ── Hearings ──────────────────────────────────────────────────────────────────

export const hearingDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    caseId: { type: "string" },
    caseTitle: { type: "string" },
    assignedLawyerId: { type: ["string", "null"] },
    assignedLawyerName: { type: ["string", "null"] },
    sessionDatetime: { type: "string" },
    nextSessionAt: { type: ["string", "null"] },
    outcome: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "caseId", "caseTitle", "sessionDatetime", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

export const hearingConflictSchema = {
  type: "object",
  properties: {
    hasConflict: { type: "boolean" },
    conflictingHearingIds: { type: "array", items: { type: "string" } }
  },
  required: ["hasConflict", "conflictingHearingIds"],
  additionalProperties: false
} as const;

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const taskDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    caseId: { type: ["string", "null"] },
    caseTitle: { type: ["string", "null"] },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    status: { type: "string" },
    priority: { type: "string" },
    assignedToId: { type: ["string", "null"] },
    assignedToName: { type: ["string", "null"] },
    createdById: { type: ["string", "null"] },
    createdByName: { type: ["string", "null"] },
    dueAt: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "title", "status", "priority", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

// ── Documents ─────────────────────────────────────────────────────────────────

const documentVersionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    documentId: { type: "string" },
    versionNumber: { type: "number" },
    fileName: { type: "string" },
    storageKey: { type: "string" },
    createdAt: { type: "string" }
  },
  required: ["id", "documentId", "versionNumber", "fileName", "storageKey", "createdAt"],
  additionalProperties: false
} as const;

export const documentDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: "string" },
    caseId: { type: ["string", "null"] },
    clientId: { type: ["string", "null"] },
    taskId: { type: ["string", "null"] },
    uploadedById: { type: ["string", "null"] },
    title: { type: "string" },
    fileName: { type: "string" },
    mimeType: { type: "string" },
    storageKey: { type: "string" },
    type: { type: "string" },
    extractionStatus: { type: "string" },
    ocrBackend: { type: "string" },
    contentText: { type: ["string", "null"] },
    versions: { type: "array", items: documentVersionSchema },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "firmId", "title", "fileName", "mimeType", "storageKey", "type", "extractionStatus", "ocrBackend", "versions", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

// ── Billing ───────────────────────────────────────────────────────────────────

const invoiceItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    invoiceId: { type: "string" },
    description: { type: "string" },
    quantity: { type: "number" },
    unitPrice: { type: "string" },
    total: { type: "string" }
  },
  required: ["id", "invoiceId", "description", "quantity", "unitPrice", "total"],
  additionalProperties: false
} as const;

const paymentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    invoiceId: { type: "string" },
    amount: { type: "string" },
    method: { type: "string" },
    referenceNumber: { type: ["string", "null"] },
    paidAt: { type: "string" },
    createdAt: { type: "string" }
  },
  required: ["id", "invoiceId", "amount", "method", "paidAt", "createdAt"],
  additionalProperties: false
} as const;

export const invoiceDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: "string" },
    caseId: { type: ["string", "null"] },
    caseTitle: { type: ["string", "null"] },
    clientId: { type: ["string", "null"] },
    clientName: { type: ["string", "null"] },
    invoiceNumber: { type: "string" },
    status: { type: "string" },
    feeType: { type: "string" },
    subtotalAmount: { type: "string" },
    taxAmount: { type: "string" },
    discountAmount: { type: "string" },
    totalAmount: { type: "string" },
    issuedAt: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
    items: { type: "array", items: invoiceItemSchema },
    payments: { type: "array", items: paymentSchema },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "firmId", "invoiceNumber", "status", "feeType", "subtotalAmount", "taxAmount", "discountAmount", "totalAmount", "items", "payments", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

export const expenseDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: "string" },
    caseId: { type: ["string", "null"] },
    caseTitle: { type: ["string", "null"] },
    category: { type: "string" },
    amount: { type: "string" },
    description: { type: ["string", "null"] },
    receiptDocumentId: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "firmId", "category", "amount", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

export const billingSummarySchema = {
  type: "object",
  properties: {
    caseId: { type: "string" },
    totalBilled: { type: "string" },
    totalPaid: { type: "string" },
    outstanding: { type: "string" },
    totalExpenses: { type: "string" },
    profitability: { type: "string" },
    invoiceCount: { type: "number" },
    expenseCount: { type: "number" }
  },
  required: ["caseId", "totalBilled", "totalPaid", "outstanding", "totalExpenses", "profitability", "invoiceCount", "expenseCount"],
  additionalProperties: false
} as const;

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: "string" },
    userId: { type: "string" },
    type: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    isRead: { type: "boolean" },
    entityType: { type: ["string", "null"] },
    entityId: { type: ["string", "null"] },
    createdAt: { type: "string" }
  },
  required: ["id", "firmId", "userId", "type", "title", "body", "isRead", "entityType", "entityId", "createdAt"],
  additionalProperties: false
} as const;

export const notificationPreferenceDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    type: { type: "string" },
    channel: { type: "string" },
    enabled: { type: "boolean" }
  },
  required: ["id", "userId", "type", "channel", "enabled"],
  additionalProperties: false
} as const;
