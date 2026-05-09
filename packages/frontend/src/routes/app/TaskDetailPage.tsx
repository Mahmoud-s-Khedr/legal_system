import { useCallback, useEffect, useMemo, useState } from "react";
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
import { confirmAction } from "../../lib/dialog";
import { toCaseSelectOption } from "../../lib/caseOptions";
import { toIsoOrEmpty } from "../../lib/dateInput";
import { getEnumLabel } from "../../lib/enumLabel";
import { resolveFormValidationError } from "../../lib/formValidation";
import { pickFieldError } from "../../lib/validationErrors";
import {
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField,
  TextAreaField
} from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { DocumentUploadForm } from "../../components/documents/DocumentUploadForm";

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const caseOptions = useMemo(
    () => [
      { value: "", label: t("labels.generalTask") },
      ...(casesQuery.data?.items ?? []).map((caseItem) =>
        toCaseSelectOption(t, caseItem)
      )
    ],
    [casesQuery.data?.items, t]
  );

  const assigneeOptions = useMemo(
    () => [
      { value: "", label: t("labels.unassigned") },
      ...(usersQuery.data?.items ?? []).map((user) => ({
        value: user.id,
        label: user.fullName
      }))
    ],
    [t, usersQuery.data?.items]
  );

  const statusOptions = useMemo(
    () =>
      Object.values(TaskStatus).map((value) => ({
        value,
        label: getEnumLabel(t, "TaskStatus", value)
      })),
    [t]
  );

  const priorityOptions = useMemo(
    () =>
      Object.values(TaskPriority).map((value) => ({
        value,
        label: getEnumLabel(t, "TaskPriority", value)
      })),
    [t]
  );

  const updateField = useCallback(
    <K extends keyof CreateTaskDto>(key: K, value: CreateTaskDto[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    []
  );

  const updateMutation = useMutation({
    mutationFn: (payload: CreateTaskDto) =>
      apiFetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...payload,
          caseId: payload.caseId?.trim() ? payload.caseId : null,
          assignedToId: payload.assignedToId?.trim()
            ? payload.assignedToId
            : null,
          dueAt: toIsoOrEmpty(payload.dueAt) || null,
          description: payload.description?.trim() ? payload.description : null
        } satisfies CreateTaskDto)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void navigate({ to: "/app/tasks" });
    },
    onError: (err: unknown) => {
      const resolved = resolveFormValidationError(err, t("errors.fallback"));
      setSubmitError(resolved.message);
      setFieldErrors(resolved.fieldErrors);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void navigate({ to: "/app/tasks" });
    }
  });

  async function handleDelete() {
    const approved = await confirmAction({
      title: t("actions.confirmDelete"),
      content: t("actions.deleteConfirmMessage"),
      okButtonProps: { danger: true }
    });
    if (!approved) return;
    await deleteMutation.mutateAsync();
  }

  function finishAndReturn() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/app/tasks" });
  }

  if (taskQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (taskQuery.isError) {
    return (
      <ErrorState
        title={t("errors.title")}
        description={
          (taskQuery.error as Error)?.message ?? t("errors.fallback")
        }
        retryLabel={t("errors.reload")}
        onRetry={() => void taskQuery.refetch()}
      />
    );
  }

  if (!taskQuery.data) {
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
        actions={
          <button
            className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => void handleDelete()}
            type="button"
          >
            {t("actions.delete")}
          </button>
        }
      />
      <SectionCard
        title={t("tasks.editTitle")}
        description={t("tasks.editHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitError(null);
            setFieldErrors({});
            updateMutation.mutate(form);
          }}
        >
          <Field
            label={t("labels.taskTitle")}
            onChange={(value) => updateField("title", value)}
            error={pickFieldError(fieldErrors, ["title"]) ?? undefined}
            value={form.title}
          />
          <TextAreaField
            label={t("labels.description")}
            onChange={(value) => updateField("description", value)}
            error={pickFieldError(fieldErrors, ["description"]) ?? undefined}
            value={form.description ?? ""}
          />
          <SelectField
            label={t("labels.case")}
            onChange={(value) => updateField("caseId", value)}
            options={caseOptions}
            error={pickFieldError(fieldErrors, ["caseId"]) ?? undefined}
            value={form.caseId ?? ""}
          />
          <SelectField
            label={t("labels.assignedLawyer")}
            onChange={(value) => updateField("assignedToId", value)}
            options={assigneeOptions}
            error={pickFieldError(fieldErrors, ["assignedToId"]) ?? undefined}
            value={form.assignedToId ?? ""}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("labels.status")}
              onChange={(value) => updateField("status", value as TaskStatus)}
              options={statusOptions}
              error={pickFieldError(fieldErrors, ["status"]) ?? undefined}
              value={form.status ?? TaskStatus.PENDING}
            />
            <SelectField
              label={t("labels.priority")}
              onChange={(value) =>
                updateField("priority", value as TaskPriority)
              }
              options={priorityOptions}
              error={pickFieldError(fieldErrors, ["priority"]) ?? undefined}
              value={form.priority ?? TaskPriority.MEDIUM}
            />
          </div>
          <Field
            dir="ltr"
            label={t("labels.dueDate")}
            onChange={(value) => updateField("dueAt", value)}
            type="datetime-local"
            commitMode="blur"
            error={pickFieldError(fieldErrors, ["dueAt"]) ?? undefined}
            value={form.dueAt ?? ""}
          />
          <PrimaryButton
            type="submit"
            disabled={updateMutation.isPending || form.title.trim().length < 2}
          >
            {t("actions.saveChanges")}
          </PrimaryButton>
          <div className="pt-2">
            <PrimaryButton type="button" onClick={finishAndReturn}>
              {t("actions.back")}
            </PrimaryButton>
          </div>
          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
        </form>
      </SectionCard>
      <SectionCard
        title={t("actions.uploadDocument")}
        description={t("documents.listHelp")}
      >
        <DocumentUploadForm
          caseId={taskQuery.data.caseId ?? undefined}
          taskId={taskId}
          invalidateKey={["task-documents", taskId]}
        />
      </SectionCard>
      <SectionCard
        description={t("documents.listHelp")}
        title={t("labels.documents")}
      >
        <DocumentList
          taskId={taskId}
          queryKey={["task-documents", taskId]}
        />
      </SectionCard>
    </div>
  );
}
