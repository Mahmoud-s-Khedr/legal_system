import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TaskPriority,
  TaskStatus,
  type CaseListResponseDto,
  type CreateTaskDto,
  type UserListResponseDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { toIsoOrEmpty } from "../../lib/dateInput";
import { getEnumLabel } from "../../lib/enumLabel";
import { useMutationFeedback } from "../../lib/feedback";
import {
  Field,
  FormAlert,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField,
  TextAreaField
} from "./ui";

export function TaskCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { caseId?: string };
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const [form, setForm] = useState<CreateTaskDto>({
    caseId: search.caseId ?? "",
    title: "",
    description: "",
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    assignedToId: "",
    dueAt: ""
  });

  useUnsavedChanges(
    Boolean(
      form.title.trim() ||
      form.description?.trim() ||
      form.caseId?.trim() ||
      form.assignedToId?.trim() ||
      form.dueAt?.trim() ||
      form.status !== TaskStatus.PENDING ||
      form.priority !== TaskPriority.MEDIUM
    ),
    { bypassBlockRef: bypassRef }
  );

  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases")
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const caseOptions = useMemo(
    () => [
      { value: "", label: t("labels.generalTask") },
      ...(casesQuery.data?.items ?? []).map((caseItem) => ({
        value: caseItem.id,
        label: caseItem.title
      }))
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

  const createMutation = useMutation({
    mutationFn: (payload: CreateTaskDto) =>
      apiFetch("/api/tasks", {
        method: "POST",
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
      feedback.success("messages.taskCreated");
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      allowNextNavigation();
      void navigate({ to: "/app/tasks" });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.createTitle")}
        description={t("tasks.createHelp")}
      />
      <SectionCard
        title={t("tasks.createTitle")}
        description={t("tasks.createHelp")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <Field
            label={t("labels.taskTitle")}
            onChange={(value) => updateField("title", value)}
            required
            value={form.title}
          />
          <TextAreaField
            label={t("labels.description")}
            onChange={(value) => updateField("description", value)}
            value={form.description ?? ""}
          />
          <SelectField
            label={t("labels.case")}
            onChange={(value) => updateField("caseId", value)}
            options={caseOptions}
            value={form.caseId ?? ""}
          />
          <SelectField
            label={t("labels.assignedLawyer")}
            onChange={(value) => updateField("assignedToId", value)}
            options={assigneeOptions}
            value={form.assignedToId ?? ""}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("labels.status")}
              onChange={(value) => updateField("status", value as TaskStatus)}
              options={statusOptions}
              value={form.status ?? TaskStatus.PENDING}
            />
            <SelectField
              label={t("labels.priority")}
              onChange={(value) =>
                updateField("priority", value as TaskPriority)
              }
              options={priorityOptions}
              value={form.priority ?? TaskPriority.MEDIUM}
            />
          </div>
          <Field
            dir="ltr"
            label={t("labels.dueDate")}
            onChange={(value) => updateField("dueAt", value)}
            type="datetime-local"
            commitMode="blur"
            value={form.dueAt ?? ""}
          />
          <FormExitActions
            cancelTo="/app/tasks"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("actions.createTask")}
            savingLabel={t("labels.saving")}
            submitting={
              createMutation.isPending || form.title.trim().length < 2
            }
          />
          {createMutation.error ? (
            <FormAlert message={(createMutation.error as Error).message} />
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
