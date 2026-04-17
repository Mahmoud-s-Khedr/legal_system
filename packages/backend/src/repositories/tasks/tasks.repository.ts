import type { CreateTaskDto, UpdateTaskDto } from "@elms/shared";
import { TaskPriority, TaskStatus, type Prisma, type Task } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

const taskInclude = {
  case: true,
  assignedTo: true,
  createdBy: true
} as const;

export type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export async function listFirmTasks(
  tx: RepositoryTx,
  where: Prisma.TaskWhereInput,
  orderBy: Prisma.TaskOrderByWithRelationInput | Prisma.TaskOrderByWithRelationInput[],
  pagination: { page: number; limit: number }
): Promise<{ total: number; items: TaskRecord[] }> {
  const { page, limit } = pagination;
  const [total, items] = await Promise.all([
    tx.task.count({ where }),
    tx.task.findMany({
      where,
      include: taskInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  return { total, items };
}

export async function getFirmTaskByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  taskId: string
): Promise<TaskRecord> {
  return tx.task.findFirstOrThrow({
    where: {
      id: taskId,
      firmId,
      deletedAt: null
    },
    include: taskInclude
  });
}

export async function getFirmTaskRowByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  taskId: string
): Promise<Task> {
  return tx.task.findFirstOrThrow({
    where: {
      id: taskId,
      firmId,
      deletedAt: null
    }
  });
}

export async function createFirmTask(
  tx: RepositoryTx,
  firmId: string,
  actorId: string,
  payload: CreateTaskDto
): Promise<TaskRecord> {
  return tx.task.create({
    data: {
      firmId,
      caseId: payload.caseId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: (payload.status as TaskStatus | undefined) ?? TaskStatus.PENDING,
      priority: (payload.priority as TaskPriority | undefined) ?? TaskPriority.MEDIUM,
      assignedToId: payload.assignedToId ?? null,
      createdById: actorId,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null
    },
    include: taskInclude
  });
}

export async function updateTaskById(
  tx: RepositoryTx,
  taskId: string,
  payload: UpdateTaskDto,
  defaults: {
    status: TaskStatus;
    priority: TaskPriority;
  }
): Promise<TaskRecord> {
  return tx.task.update({
    where: { id: taskId },
    data: {
      caseId: payload.caseId ?? null,
      title: payload.title,
      description: payload.description ?? null,
      status: (payload.status as TaskStatus | undefined) ?? defaults.status,
      priority: (payload.priority as TaskPriority | undefined) ?? defaults.priority,
      assignedToId: payload.assignedToId ?? null,
      dueAt: payload.dueAt ? new Date(payload.dueAt) : null
    },
    include: taskInclude
  });
}

export async function updateTaskStatusById(
  tx: RepositoryTx,
  taskId: string,
  status: TaskStatus
): Promise<TaskRecord> {
  return tx.task.update({
    where: { id: taskId },
    data: { status },
    include: taskInclude
  });
}

export async function softDeleteTaskById(tx: RepositoryTx, taskId: string): Promise<void> {
  await tx.task.update({
    where: { id: taskId },
    data: {
      deletedAt: new Date()
    }
  });
}
