import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TaskStatus, type TaskListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { EmptyState, PageHeader, SectionCard, SelectField, formatDateTime } from "./ui";

export function TasksPage() {
  const { t, i18n } = useTranslation("app");
  const [statusFilter, setStatusFilter] = useState("");

  const tasksQuery = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: () =>
      apiFetch<TaskListResponseDto>(
        statusFilter ? `/api/tasks?status=${encodeURIComponent(statusFilter)}` : "/api/tasks"
      )
  });

  const isRtl = i18n.resolvedLanguage === "ar";

  const kanbanColumns = useMemo(
    () => {
      const statuses = Object.values(TaskStatus);
      const ordered = isRtl ? [...statuses].reverse() : statuses;
      return ordered.map((status) => ({
        status,
        items: (tasksQuery.data?.items ?? []).filter((task) => task.status === status)
      }));
    },
    [tasksQuery.data?.items, isRtl]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.title")}
        description={t("tasks.description")}
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/tasks/new"
          >
            {t("actions.newTask")}
          </Link>
        }
      />
      <SectionCard title={t("tasks.board")} description={t("tasks.boardHelp")}>
        <SelectField
          label={t("labels.status")}
          onChange={setStatusFilter}
          options={[
            { value: "", label: t("labels.all") },
            ...Object.values(TaskStatus).map((value) => ({
              value,
              label: getEnumLabel(t, "TaskStatus", value)
            }))
          ]}
          value={statusFilter}
        />
        <div className="mt-4 grid gap-4 xl:grid-cols-5">
          {kanbanColumns.map((column) => (
            <div className="space-y-3" key={column.status}>
              <p className="font-semibold">{getEnumLabel(t, "TaskStatus", column.status)}</p>
              {!column.items.length ? (
                <EmptyState title={t("empty.noTasks")} description={t("empty.noTasksHelp")} />
              ) : (
                column.items.map((task) => (
                  <Link
                    className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent"
                    key={task.id}
                    params={{ taskId: task.id }}
                    to="/app/tasks/$taskId"
                  >
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {task.assignedToName ?? t("labels.unassigned")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(task.dueAt)}</p>
                  </Link>
                ))
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
