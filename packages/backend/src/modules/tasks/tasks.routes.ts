import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { TaskPriority, TaskStatus } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { taskDtoSchema, listResponseSchema, successSchema } from "../../schemas/index.js";
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask
} from "./tasks.service.js";

const taskSchema = z.object({
  caseId: z.string().uuid().nullable().optional(),
  title: z.string().min(2),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional()
});

const taskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus)
});

const taskListQuerySchema = z.object({
  caseId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  overdue: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

export async function registerTaskRoutes(app: FastifyInstance) {
  app.get(
    "/api/tasks",
    {
      schema: { response: { 200: listResponseSchema(taskDtoSchema) } },
      preHandler: [requireAuth, requirePermission("tasks:read")]
    },
    async (request) => {
      const filters = taskListQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(filters);
      return listTasks(request.sessionUser!, filters, { page, limit });
    }
  );

  app.post(
    "/api/tasks",
    {
      schema: { response: { 200: taskDtoSchema } },
      preHandler: [requireAuth, requirePermission("tasks:create")]
    },
    async (request) => {
      const payload = taskSchema.parse(request.body);
      return createTask(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.get(
    "/api/tasks/:id",
    {
      schema: { response: { 200: taskDtoSchema } },
      preHandler: [requireAuth, requirePermission("tasks:read")]
    },
    async (request) => getTask(request.sessionUser!, (request.params as { id: string }).id)
  );

  app.put(
    "/api/tasks/:id",
    {
      schema: { response: { 200: taskDtoSchema } },
      preHandler: [requireAuth, requirePermission("tasks:update")]
    },
    async (request) => {
      const payload = taskSchema.parse(request.body);
      return updateTask(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.patch(
    "/api/tasks/:id/status",
    {
      schema: { response: { 200: taskDtoSchema } },
      preHandler: [requireAuth, requirePermission("tasks:update")]
    },
    async (request) => {
      const payload = taskStatusSchema.parse(request.body);
      return changeTaskStatus(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/tasks/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("tasks:delete")]
    },
    async (request) =>
      deleteTask(
        request.sessionUser!,
        (request.params as { id: string }).id,
        getAuditContext(request)
      )
  );
}
