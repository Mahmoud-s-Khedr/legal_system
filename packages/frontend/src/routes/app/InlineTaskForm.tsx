import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TaskPriority, TaskStatus, type CreateTaskDto, type UserListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { Field, SelectField } from "./ui";

interface Props {
  caseId: string;
  onSuccess: () => void;
}

export function InlineTaskForm({ caseId, onSuccess }: Props) {
  const { t } = useTranslation("app");
  const [form, setForm] = useState<CreateTaskDto>({
    caseId,
    title: "",
    description: "",
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    assignedToId: "",
    dueAt: ""
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<UserListResponseDto>("/api/users")
  });

  const assigneeOptions = [
    { value: "", label: t("labels.unassigned") },
    ...(usersQuery.data?.items ?? []).map((u) => ({ value: u.id, label: u.fullName }))
  ];

  const priorityOptions = Object.values(TaskPriority).map((v) => ({
    value: v,
    label: getEnumLabel(t, "TaskPriority", v)
  }));

  const mutation = useMutation({
    mutationFn: (payload: CreateTaskDto) =>
      apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          assignedToId: payload.assignedToId || null,
          dueAt: payload.dueAt ? new Date(`${payload.dueAt}T09:00:00`).toISOString() : null,
          description: payload.description || null
        })
      }),
    onSuccess
  });

  function set<K extends keyof CreateTaskDto>(key: K, value: CreateTaskDto[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            commitMode="blur"
            label={t("labels.title")}
            onChange={(v) => set("title", v)}
            required
            value={form.title}
          />
        </div>
        <SelectField
          label={t("labels.priority")}
          onChange={(v) => set("priority", v as TaskPriority)}
          options={priorityOptions}
          value={form.priority ?? TaskPriority.MEDIUM}
        />
        <SelectField
          label={t("labels.assignedLawyer")}
          onChange={(v) => set("assignedToId", v)}
          options={assigneeOptions}
          value={form.assignedToId ?? ""}
        />
        <Field
          commitMode="blur"
          label={t("labels.dueDate")}
          onChange={(v) => set("dueAt", v)}
          type="date"
          value={form.dueAt ?? ""}
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? t("labels.saving") : t("actions.save")}
        </button>
        <Link
          className="text-sm text-slate-500 hover:text-accent"
          search={{ caseId }}
          to="/app/tasks/new"
        >
          {t("labels.advancedOptions", "Advanced options")} →
        </Link>
      </div>
      {mutation.isError && (
        <p className="mt-2 text-sm text-red-600">
          {(mutation.error as Error)?.message ?? t("errors.fallback")}
        </p>
      )}
    </form>
  );
}
