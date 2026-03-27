import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TaskStatus, type TaskListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, SelectField, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper, formatDateTime } from "./ui";

type TaskViewMode = "table" | "kanban";

export function TasksPage() {
  const { t, i18n } = useTranslation("app");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<TaskViewMode>("table");

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
        <div className="grid gap-4 md:grid-cols-2">
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
          <SelectField
            label={t("labels.type")}
            onChange={(value) => setViewMode(value as TaskViewMode)}
            options={[
              { value: "table", label: "Table" },
              { value: "kanban", label: "Kanban" }
            ]}
            value={viewMode}
          />
        </div>

        {tasksQuery.isError ? (
          <div className="mt-4">
            <ErrorState
              title={t("errors.title")}
              description={(tasksQuery.error as Error)?.message ?? t("errors.fallback")}
              retryLabel={t("errors.reload")}
              onRetry={() => void tasksQuery.refetch()}
            />
          </div>
        ) : null}

        {!tasksQuery.isError && !(tasksQuery.data?.items.length ?? 0) ? (
          <div className="mt-4">
            <EmptyState title={t("empty.noTasks")} description={t("empty.noTasksHelp")} />
          </div>
        ) : null}

        {!tasksQuery.isError && viewMode === "table" && !!tasksQuery.data?.items.length ? (
          <div className="mt-4">
            <TableWrapper>
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t("labels.title")}</TableHeadCell>
                    <TableHeadCell>{t("labels.status")}</TableHeadCell>
                    <TableHeadCell>{t("labels.priority")}</TableHeadCell>
                    <TableHeadCell>{t("labels.assignedLawyer")}</TableHeadCell>
                    <TableHeadCell>{t("labels.dueDate")}</TableHeadCell>
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {tasksQuery.data.items.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>{getEnumLabel(t, "TaskStatus", task.status)}</TableCell>
                      <TableCell>{getEnumLabel(t, "TaskPriority", task.priority)}</TableCell>
                      <TableCell>{task.assignedToName ?? t("labels.unassigned")}</TableCell>
                      <TableCell>{formatDateTime(task.dueAt)}</TableCell>
                      <TableCell align="end">
                        <Link
                          className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          key={task.id}
                          params={{ taskId: task.id }}
                          to="/app/tasks/$taskId"
                        >
                          {t("actions.edit")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrapper>
          </div>
        ) : null}

        {!tasksQuery.isError && viewMode === "kanban" && !!tasksQuery.data?.items.length ? (
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
        ) : null}
      </SectionCard>
    </div>
  );
}
