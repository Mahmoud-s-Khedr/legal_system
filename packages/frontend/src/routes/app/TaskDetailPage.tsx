import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TaskPriority,
  TaskStatus,
  type CaseListResponseDto,
  type CreateTaskDto,
  type TaskDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { EmptyState, Field, PageHeader, PrimaryButton, SectionCard, SelectField, TextAreaField } from "./ui";

export function TaskDetailPage() {
  const { t } = useTranslation("app");
  const { taskId } = useParams({ from: "/app/tasks/$taskId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => apiFetch<TaskDto>(`/api/tasks/${taskId}`)
  });
  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases")
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const [form, setForm] = useState<CreateTaskDto>({
    caseId: "",
    title: "",
    description: "",
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    assignedToId: "",
    dueAt: ""
  });

  useEffect(() => {
    if (taskQuery.data) {
      const task = taskQuery.data;
      setForm({
        caseId: task.caseId ?? "",
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        assignedToId: task.assignedToId ?? "",
        dueAt: task.dueAt ?? ""
      });
    }
  }, [taskQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: CreateTaskDto) =>
      apiFetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void navigate({ to: "/app/tasks" });
    }
  });

  if (!taskQuery.data && !taskQuery.isLoading) {
    return (
      <EmptyState
        title={t("empty.noTasks")}
        description={t("empty.noTasksHelp")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={taskQuery.data?.title ?? "..."}
        description={t("tasks.editHelp")}
      />
      <SectionCard title={t("tasks.editTitle")} description={t("tasks.editHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(form);
          }}
        >
          <Field
            label={t("labels.title")}
            onChange={(value) => setForm({ ...form, title: value })}
            value={form.title}
          />
          <TextAreaField
            label={t("labels.description")}
            onChange={(value) => setForm({ ...form, description: value })}
            value={form.description ?? ""}
          />
          <SelectField
            label={t("labels.case")}
            onChange={(value) => setForm({ ...form, caseId: value })}
            options={[
              { value: "", label: t("labels.generalTask") },
              ...(casesQuery.data?.items ?? []).map((caseItem) => ({
                value: caseItem.id,
                label: caseItem.title
              }))
            ]}
            value={form.caseId ?? ""}
          />
          <SelectField
            label={t("labels.assignedLawyer")}
            onChange={(value) => setForm({ ...form, assignedToId: value })}
            options={[
              { value: "", label: t("labels.unassigned") },
              ...(usersQuery.data?.items ?? []).map((user) => ({
                value: user.id,
                label: user.fullName
              }))
            ]}
            value={form.assignedToId ?? ""}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("labels.status")}
              onChange={(value) => setForm({ ...form, status: value as TaskStatus })}
              options={Object.values(TaskStatus).map((value) => ({
                value,
                label: getEnumLabel(t, "TaskStatus", value)
              }))}
              value={form.status ?? TaskStatus.PENDING}
            />
            <SelectField
              label={t("labels.priority")}
              onChange={(value) => setForm({ ...form, priority: value as TaskPriority })}
              options={Object.values(TaskPriority).map((value) => ({
                value,
                label: getEnumLabel(t, "TaskPriority", value)
              }))}
              value={form.priority ?? TaskPriority.MEDIUM}
            />
          </div>
          <Field
            dir="ltr"
            label={t("labels.dueDate")}
            onChange={(value) => setForm({ ...form, dueAt: value })}
            type="datetime-local"
            value={form.dueAt ?? ""}
          />
          <PrimaryButton type="submit">{t("actions.saveChanges")}</PrimaryButton>
          {updateMutation.error ? (
            <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
