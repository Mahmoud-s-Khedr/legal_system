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
import { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";

function mapTask(task: {
  id: string;
  caseId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedToId: string | null;
  createdById: string | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  case: { title: string } | null;
  assignedTo: { fullName: string } | null;
  createdBy: { fullName: string } | null;
}): TaskDto {
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

  return withTenant(prisma, actor.firmId, async (tx) => {
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

    const [total, tasks] = await Promise.all([
      tx.task.count({ where }),
      tx.task.findMany({
        where,
        include: {
          case: true,
          assignedTo: true,
          createdBy: true
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      items: tasks.map(mapTask),
      total,
      page,
      pageSize: limit
    };
  });
}

export async function getTask(actor: SessionUser, taskId: string): Promise<TaskDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const task = await tx.task.findFirstOrThrow({
      where: {
        id: taskId,
        firmId: actor.firmId,
        deletedAt: null
      },
      include: {
        case: true,
        assignedTo: true,
        createdBy: true
      }
    });

    return mapTask(task);
  });
}

export async function createTask(
  actor: SessionUser,
  payload: CreateTaskDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const task = await tx.task.create({
      data: {
        firmId: actor.firmId,
        caseId: payload.caseId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        status: (payload.status as TaskStatus | undefined) ?? TaskStatus.PENDING,
        priority: (payload.priority as TaskPriority | undefined) ?? TaskPriority.MEDIUM,
        assignedToId: payload.assignedToId ?? null,
        createdById: actor.id,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null
      },
      include: {
        case: true,
        assignedTo: true,
        createdBy: true
      }
    });

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
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.task.findFirstOrThrow({
      where: {
        id: taskId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        caseId: payload.caseId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        status: (payload.status as TaskStatus | undefined) ?? existing.status,
        priority: (payload.priority as TaskPriority | undefined) ?? existing.priority,
        assignedToId: payload.assignedToId ?? null,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null
      },
      include: {
        case: true,
        assignedTo: true,
        createdBy: true
      }
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
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.task.findFirstOrThrow({
      where: {
        id: taskId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        status: payload.status as never
      },
      include: {
        case: true,
        assignedTo: true,
        createdBy: true
      }
    });

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
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.task.findFirstOrThrow({
      where: {
        id: taskId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        deletedAt: new Date()
      }
    });

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
