import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskStatus, type TaskListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { useTableQueryState } from "../../lib/tableQueryState";
import { useToastStore } from "../../store/toastStore";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  ResponsiveDataList,
  SectionCard,
  SelectField,
  SortableTableHeadCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TablePagination,
  TableRow,
  TableWrapper,
  formatDateTime
} from "./ui";

type TaskViewMode = "table" | "kanban";

export function TasksPage() {
  const { t, i18n } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const [viewMode, setViewMode] = useState<TaskViewMode>("table");
  const queryClient = useQueryClient();
  const markDoneMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: TaskStatus.DONE })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (error: Error) => {
      addToast(error.message || t("errors.fallback"), "error");
    }
  });
  const table = useTableQueryState({
    defaultSortBy: "dueAt",
    defaultSortDir: "asc",
    defaultLimit: 20,
    filterKeys: ["status"]
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", table.state],
    queryFn: () =>
      apiFetch<TaskListResponseDto>(`/api/tasks?${table.toApiQueryString()}`)
  });
  const kanbanQuery = useQuery({
    queryKey: ["tasks-kanban", table.state.q, table.state.filters.status],
    queryFn: () =>
      apiFetch<TaskListResponseDto>(
        `/api/tasks?${table.toApiQueryString({
          page: 1,
          limit: 500
        })}`
      ),
    enabled: viewMode === "kanban"
  });

  const isRtl = i18n.resolvedLanguage === "ar";

  const kanbanColumns = useMemo(() => {
    const statuses = Object.values(TaskStatus);
    const ordered = isRtl ? [...statuses].reverse() : statuses;
    return ordered.map((status) => ({
      status,
      items: (kanbanQuery.data?.items ?? []).filter(
        (task) => task.status === status
      )
    }));
  }, [kanbanQuery.data?.items, isRtl]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.title")}
        description={t("tasks.description")}
        stickyActions
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
          <Field
            label={t("labels.search")}
            onChange={table.setQ}
            value={table.state.q}
            placeholder={t("tasks.searchPlaceholder")}
          />
          <SelectField
            label={t("labels.status")}
            onChange={(value) => table.setFilter("status", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...Object.values(TaskStatus).map((value) => ({
                value,
                label: getEnumLabel(t, "TaskStatus", value)
              }))
            ]}
            value={table.state.filters.status ?? ""}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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
              description={
                (tasksQuery.error as Error)?.message ?? t("errors.fallback")
              }
              retryLabel={t("errors.reload")}
              onRetry={() => void tasksQuery.refetch()}
            />
          </div>
        ) : null}

        {!tasksQuery.isError &&
        !tasksQuery.isLoading &&
        !(tasksQuery.data?.items.length ?? 0) ? (
          <div className="mt-4">
            <EmptyState
              title={t("empty.noTasks")}
              description={t("empty.noTasksHelp")}
            />
          </div>
        ) : null}

        {!tasksQuery.isError &&
        viewMode === "table" &&
        !!tasksQuery.data?.items.length ? (
          <div className="mt-4">
            <ResponsiveDataList
              items={tasksQuery.data.items}
              getItemKey={(item) => item.id}
              fields={[
                {
                  key: "title",
                  label: t("labels.taskTitle"),
                  render: (item) => (
                    <span
                      className={
                        item.status === TaskStatus.DONE
                          ? "line-through text-slate-400"
                          : ""
                      }
                    >
                      {item.title}
                    </span>
                  )
                },
                {
                  key: "status",
                  label: t("labels.status"),
                  render: (item) => getEnumLabel(t, "TaskStatus", item.status)
                },
                {
                  key: "priority",
                  label: t("labels.priority"),
                  render: (item) =>
                    getEnumLabel(t, "TaskPriority", item.priority)
                },
                {
                  key: "dueAt",
                  label: t("labels.dueDate"),
                  render: (item) => formatDateTime(item.dueAt)
                }
              ]}
              actions={(item) => (
                <>
                  <button
                    aria-label={t("actions.markDone")}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    disabled={
                      markDoneMutation.isPending ||
                      item.status === TaskStatus.DONE
                    }
                    onClick={() => {
                      if (item.status !== TaskStatus.DONE)
                        markDoneMutation.mutate(item.id);
                    }}
                    type="button"
                  >
                    {t("actions.markDone")}
                  </button>
                  <Link
                    className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    params={{ taskId: item.id }}
                    to="/app/tasks/$taskId"
                  >
                    {t("actions.edit")}
                  </Link>
                </>
              )}
            />
            <TableWrapper mobileMode="cards">
              <DataTable>
                <TableHead>
                  <tr>
                    <TableHeadCell />
                    <SortableTableHeadCell
                      label={t("labels.taskTitle")}
                      sortKey="title"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <SortableTableHeadCell
                      label={t("labels.status")}
                      sortKey="status"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <SortableTableHeadCell
                      label={t("labels.priority")}
                      sortKey="priority"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <TableHeadCell>{t("labels.assignedLawyer")}</TableHeadCell>
                    <SortableTableHeadCell
                      label={t("labels.dueDate")}
                      sortKey="dueAt"
                      sortBy={table.state.sortBy}
                      sortDir={table.state.sortDir}
                      onSort={table.setSort}
                    />
                    <TableHeadCell align="end">
                      {t("actions.more")}
                    </TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {tasksQuery.data.items.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <input
                          aria-label={t("actions.markDone")}
                          checked={task.status === TaskStatus.DONE}
                          className="h-4 w-4 cursor-pointer accent-accent"
                          disabled={markDoneMutation.isPending}
                          onChange={() => {
                            if (task.status !== TaskStatus.DONE)
                              markDoneMutation.mutate(task.id);
                          }}
                          type="checkbox"
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            task.status === TaskStatus.DONE
                              ? "line-through text-slate-400"
                              : ""
                          }
                        >
                          {task.title}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getEnumLabel(t, "TaskStatus", task.status)}
                      </TableCell>
                      <TableCell>
                        {getEnumLabel(t, "TaskPriority", task.priority)}
                      </TableCell>
                      <TableCell>
                        {task.assignedToName ?? t("labels.unassigned")}
                      </TableCell>
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
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={tasksQuery.data?.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </div>
        ) : null}

        {!tasksQuery.isError && viewMode === "kanban" && (
          <div className="mt-4 grid gap-4 xl:grid-cols-5">
            {kanbanColumns.map((column) => (
              <div className="space-y-3" key={column.status}>
                <p className="font-semibold">
                  {getEnumLabel(t, "TaskStatus", column.status)}
                </p>
                {!column.items.length ? (
                  <EmptyState
                    title={t("empty.noTasks")}
                    description={t("empty.noTasksHelp")}
                  />
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
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(task.dueAt)}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
