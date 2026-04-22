import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskStatus } from "@prisma/client";
import { makeSessionUser } from "../../test-utils/session-user.js";

const inTenantTransaction = vi.fn();
const writeAuditLog = vi.fn();
const buildFuzzySearchCandidates = vi.fn();
const normalizeSort = vi.fn();
const toPrismaSortOrder = vi.fn();

const listFirmTasks = vi.fn();
const getFirmTaskByIdOrThrow = vi.fn();
const getFirmTaskRowByIdOrThrow = vi.fn();
const createFirmTask = vi.fn();
const updateTaskById = vi.fn();
const updateTaskStatusById = vi.fn();
const softDeleteTaskById = vi.fn();

vi.mock("../../repositories/unitOfWork.js", () => ({ inTenantTransaction }));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog }));
vi.mock("../../utils/fuzzySearch.js", () => ({ buildFuzzySearchCandidates }));
vi.mock("../../utils/tableQuery.js", () => ({ normalizeSort, toPrismaSortOrder }));
vi.mock("../../repositories/tasks/tasks.repository.js", () => ({
  listFirmTasks,
  getFirmTaskByIdOrThrow,
  getFirmTaskRowByIdOrThrow,
  createFirmTask,
  updateTaskById,
  updateTaskStatusById,
  softDeleteTaskById
}));

const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  changeTaskStatus,
  deleteTask
} = await import("./tasks.service.js");

const actor = makeSessionUser({ id: "u-1", firmId: "f-1" });
const audit = { ipAddress: "127.0.0.1", userAgent: "vitest" };

const now = new Date("2026-04-20T12:00:00.000Z");
const baseTask = {
  id: "t-1",
  caseId: "c-1",
  title: "Task",
  description: "Desc",
  status: "PENDING",
  priority: "MEDIUM",
  assignedToId: "u-2",
  createdById: "u-1",
  dueAt: now,
  createdAt: now,
  updatedAt: now,
  case: { title: "Case A" },
  assignedTo: { fullName: "Lawyer" },
  createdBy: { fullName: "Creator" }
};

beforeEach(() => {
  vi.clearAllMocks();
  inTenantTransaction.mockImplementation(async (_firmId, fn) => fn({ tx: true }));
  buildFuzzySearchCandidates.mockReturnValue(["task", "tsk"]);
  normalizeSort.mockReturnValue("dueAt");
  toPrismaSortOrder.mockReturnValue("asc");
});

describe("tasks.service", () => {
  it("lists tasks with search, overdue and due-date filters", async () => {
    listFirmTasks.mockResolvedValue({ total: 1, items: [baseTask] });

    const result = await listTasks(
      actor,
      {
        q: "task",
        overdue: "true",
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T00:00:00.000Z",
        sortBy: "dueAt",
        sortDir: "asc"
      },
      { page: 2, limit: 10 }
    );

    expect(listFirmTasks).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({
        firmId: "f-1",
        deletedAt: null,
        OR: expect.any(Array),
        dueAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date), lt: expect.any(Date) }),
        status: { not: TaskStatus.DONE }
      }),
      [{ dueAt: "asc" }, { createdAt: "desc" }],
      { page: 2, limit: 10 }
    );
    expect(result.total).toBe(1);
    expect(result.items[0]?.caseTitle).toBe("Case A");
  });

  it("gets task by id", async () => {
    getFirmTaskByIdOrThrow.mockResolvedValue(baseTask);

    const result = await getTask(actor, "t-1");

    expect(getFirmTaskByIdOrThrow).toHaveBeenCalledWith({ tx: true }, "f-1", "t-1");
    expect(result.id).toBe("t-1");
  });

  it("creates task and writes audit log", async () => {
    createFirmTask.mockResolvedValue(baseTask);

    const result = await createTask(actor, { title: "Task", dueAt: null }, audit as never);

    expect(createFirmTask).toHaveBeenCalledWith({ tx: true }, "f-1", "u-1", { title: "Task", dueAt: null });
    expect(writeAuditLog).toHaveBeenCalledWith(
      { tx: true },
      audit,
      expect.objectContaining({ action: "tasks.create", entityType: "Task", entityId: "t-1" })
    );
    expect(result.id).toBe("t-1");
  });

  it("updates task and logs old/new values", async () => {
    getFirmTaskRowByIdOrThrow.mockResolvedValue({ ...baseTask, status: "PENDING", priority: "LOW" });
    updateTaskById.mockResolvedValue({ ...baseTask, title: "Updated", status: "DONE" });

    const result = await updateTask(actor, "t-1", { title: "Updated" }, audit as never);

    expect(updateTaskById).toHaveBeenCalledWith(
      { tx: true },
      "t-1",
      { title: "Updated" },
      { status: "PENDING", priority: "LOW" }
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      { tx: true },
      audit,
      expect.objectContaining({ action: "tasks.update", entityId: "t-1" })
    );
    expect(result.title).toBe("Updated");
  });

  it("changes task status and deletes task with audit entries", async () => {
    getFirmTaskRowByIdOrThrow.mockResolvedValue(baseTask);
    updateTaskStatusById.mockResolvedValue({ ...baseTask, status: "DONE" });

    const statusResult = await changeTaskStatus(actor, "t-1", { status: "DONE" }, audit as never);
    expect(updateTaskStatusById).toHaveBeenCalledWith({ tx: true }, "t-1", "DONE");
    expect(statusResult.status).toBe("DONE");

    softDeleteTaskById.mockResolvedValue(undefined);
    const deleteResult = await deleteTask(actor, "t-1", audit as never);

    expect(softDeleteTaskById).toHaveBeenCalledWith({ tx: true }, "t-1");
    expect(deleteResult).toEqual({ success: true });
  });
});
