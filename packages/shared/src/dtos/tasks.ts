import { TaskPriority, TaskStatus } from "../enums/index";
import type { ApiListResponse } from "../types/common";

export interface TaskDto {
  id: string;
  caseId: string | null;
  caseTitle: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: string | null;
  assignedToName: string | null;
  createdById: string | null;
  createdByName: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskDto {
  caseId?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: string | null;
  dueAt?: string | null;
}

export type UpdateTaskDto = CreateTaskDto;

export interface ChangeTaskStatusDto {
  status: TaskStatus;
}

export type TaskListResponseDto = ApiListResponse<TaskDto>;
