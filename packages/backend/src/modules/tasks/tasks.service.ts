import type {
  ChangeTaskStatusDto,
  CreateTaskDto,
  SessionUser,
  TaskDto,
  TaskListResponseDto,
  TaskPriority as SharedTaskPriority,
  TaskStatus as SharedTaskStatus,
  UpdateTaskDto
} from "@elms/shared";
import { Prisma, TaskStatus } from "@prisma/client";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createFirmTask,
  getFirmTaskByIdOrThrow,
  getFirmTaskRowByIdOrThrow,
  listFirmTasks,
  softDeleteTaskById,
  updateTaskById,
  updateTaskStatusById,
  type TaskRecord
} from "../../repositories/tasks/tasks.repository.js";

function mapTask(task: TaskRecord): TaskDto {
  return {
    id: task.id,
    caseId: task.caseId,
    caseTitle: task.case?.title ?? null,
    title: task.title,
    description: task.description,
    status: task.status as SharedTaskStatus,
    priority: task.priority as SharedTaskPriority,
    assignedToId: task.assignedToId,
    assignedToName: task.assignedTo?.fullName ?? null,
    createdById: task.createdById,
    createdByName: task.createdBy?.fullName ?? null,
    dueAt: task.dueAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export async function listTasks(
  actor: SessionUser,
  filters: {
    q?: string;
    caseId?: string;
    assignedToId?: string;
    status?: string;
    overdue?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortDir?: SortDir;
  },
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<TaskListResponseDto> {
  const { page, limit } = pagination;
  const q = filters.q?.trim();
  const sortBy = normalizeSort(filters.sortBy, ["dueAt", "createdAt", "title", "priority", "status"] as const, "dueAt");
  const sortDir = toPrismaSortOrder(filters.sortDir ?? "asc");

  const orderBy: Prisma.TaskOrderByWithRelationInput | Prisma.TaskOrderByWithRelationInput[] =
    sortBy === "dueAt"
      ? [{ dueAt: sortDir }, { createdAt: "desc" }]
      : { [sortBy]: sortDir };

  return inTenantTransaction(actor.firmId, async (tx) => {
    const dueAtFilter: { lt?: Date; gte?: Date; lte?: Date } = {};
    if (filters.overdue === "true") {
      dueAtFilter.lt = new Date();
    }
    if (filters.from) {
      dueAtFilter.gte = new Date(filters.from);
    }
    if (filters.to) {
      dueAtFilter.lte = new Date(filters.to);
    }

    const where = {
      firmId: actor.firmId,
      deletedAt: null,
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
      ...(filters.status ? { status: filters.status as TaskStatus } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
              { case: { title: { contains: q, mode: "insensitive" as const } } },
              { assignedTo: { fullName: { contains: q, mode: "insensitive" as const } } }
            ]
          }
        : {}),
      ...(Object.keys(dueAtFilter).length > 0 ? { dueAt: dueAtFilter } : {}),
      ...(filters.overdue === "true"
        ? {
            status: {
              not: TaskStatus.DONE
            }
          }
        : {})
    };

    const { total, items } = await listFirmTasks(tx, where, orderBy, { page, limit });

    return {
      items: items.map(mapTask),
      total,
      page,
      pageSize: limit
    };
  });
}

export async function getTask(actor: SessionUser, taskId: string): Promise<TaskDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const task = await getFirmTaskByIdOrThrow(tx, actor.firmId, taskId);

    return mapTask(task);
  });
}

export async function createTask(
  actor: SessionUser,
  payload: CreateTaskDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const task = await createFirmTask(tx, actor.firmId, actor.id, payload);

    await writeAuditLog(tx, audit, {
      action: "tasks.create",
      entityType: "Task",
      entityId: task.id,
      newData: {
        title: task.title,
        caseId: task.caseId
      }
    });

    return mapTask(task);
  });
}

export async function updateTask(
  actor: SessionUser,
  taskId: string,
  payload: UpdateTaskDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmTaskRowByIdOrThrow(tx, actor.firmId, taskId);

    const task = await updateTaskById(tx, taskId, payload, {
      status: existing.status,
      priority: existing.priority
    });

    await writeAuditLog(tx, audit, {
      action: "tasks.update",
      entityType: "Task",
      entityId: task.id,
      oldData: {
        title: existing.title,
        status: existing.status
      },
      newData: {
        title: task.title,
        status: task.status
      }
    });

    return mapTask(task);
  });
}

export async function changeTaskStatus(
  actor: SessionUser,
  taskId: string,
  payload: ChangeTaskStatusDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmTaskRowByIdOrThrow(tx, actor.firmId, taskId);

    const task = await updateTaskStatusById(tx, taskId, payload.status as TaskStatus);

    await writeAuditLog(tx, audit, {
      action: "tasks.status",
      entityType: "Task",
      entityId: task.id,
      oldData: {
        status: existing.status
      },
      newData: {
        status: task.status
      }
    });

    return mapTask(task);
  });
}

export async function deleteTask(
  actor: SessionUser,
  taskId: string,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmTaskRowByIdOrThrow(tx, actor.firmId, taskId);

    await softDeleteTaskById(tx, taskId);

    await writeAuditLog(tx, audit, {
      action: "tasks.delete",
      entityType: "Task",
      entityId: taskId,
      oldData: {
        title: existing.title
      }
    });

    return { success: true as const };
  });
}
