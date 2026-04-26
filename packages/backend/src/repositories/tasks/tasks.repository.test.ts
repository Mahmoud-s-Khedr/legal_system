import { describe, expect, it, vi } from "vitest";
import { TaskPriority, TaskStatus } from "@elms/shared";
import {
  listFirmTasks,
  getFirmTaskByIdOrThrow,
  getFirmTaskRowByIdOrThrow,
  createFirmTask,
  updateTaskById,
  updateTaskStatusById,
  softDeleteTaskById
} from "./tasks.repository.js";

function createTx() {
  return {
    task: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };
}

describe("tasks.repository", () => {
  it("lists tasks with pagination", async () => {
    const tx = createTx();
    tx.task.count.mockResolvedValue(2);
    tx.task.findMany.mockResolvedValue([{ id: "t-1" }]);

    const result = await listFirmTasks(
      tx as never,
      { firmId: "f-1" },
      [{ dueAt: "asc" }],
      { page: 2, limit: 10 }
    );

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(tx.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, include: expect.any(Object) })
    );
  });

  it("gets firm task with and without include", async () => {
    const tx = createTx();
    tx.task.findFirstOrThrow.mockResolvedValue({ id: "t-1" });

    await getFirmTaskByIdOrThrow(tx as never, "f-1", "t-1");
    await getFirmTaskRowByIdOrThrow(tx as never, "f-1", "t-1");

    expect(tx.task.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-1", firmId: "f-1", deletedAt: null }, include: expect.any(Object) })
    );
    expect(tx.task.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-1", firmId: "f-1", deletedAt: null } })
    );
  });

  it("creates task with defaults and optional dueAt conversion", async () => {
    const tx = createTx();
    tx.task.create.mockResolvedValue({ id: "t-1" });

    await createFirmTask(
      tx as never,
      "f-1",
      "u-1",
      { title: "Task 1" }
    );
    await createFirmTask(
      tx as never,
      "f-1",
      "u-1",
      {
        title: "Task 2",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        dueAt: "2026-04-22T00:00:00.000Z",
        description: "x"
      }
    );

    expect(tx.task.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", priority: "MEDIUM", dueAt: null }) })
    );
    expect(tx.task.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: TaskStatus.DONE,
          priority: TaskPriority.HIGH,
          dueAt: expect.any(Date)
        })
      })
    );
  });

  it("updates task fields and status", async () => {
    const tx = createTx();
    tx.task.update.mockResolvedValue({ id: "t-1" });

    await updateTaskById(
      tx as never,
      "t-1",
      { title: "Updated", dueAt: "2026-05-01T00:00:00.000Z" },
      { status: "PENDING" as never, priority: "LOW" as never }
    );
    await updateTaskById(
      tx as never,
      "t-1",
      {
        title: "Updated",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        description: "ok",
        assignedToId: "u-2",
        caseId: "c-1"
      },
      { status: "PENDING" as never, priority: "LOW" as never }
    );

    await updateTaskStatusById(tx as never, "t-1", TaskStatus.DONE as never);

    expect(tx.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-1" }, data: expect.objectContaining({ status: TaskStatus.DONE }) })
    );
  });

  it("soft deletes task by setting deletedAt", async () => {
    const tx = createTx();
    tx.task.update.mockResolvedValue({ id: "t-1" });

    await softDeleteTaskById(tx as never, "t-1");

    expect(tx.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-1" }, data: { deletedAt: expect.any(Date) } })
    );
  });
});
