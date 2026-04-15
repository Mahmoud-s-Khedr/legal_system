import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { NotificationType, type NotificationDto, type NotificationListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { useMutationFeedback } from "../../lib/feedback";
import { useTableQueryState } from "../../lib/tableQueryState";
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
  TableToolbar,
  TableWrapper,
  formatDateTime
} from "./ui";

function resolveNotificationPath(n: NotificationDto): string | null {
  const id = n.entityId;
  if (!id) return null;
  switch (n.type) {
    case NotificationType.HEARING_7_DAYS:
    case NotificationType.HEARING_TOMORROW:
    case NotificationType.HEARING_TODAY:
      return `/app/hearings/${id}/edit`;
    case NotificationType.TASK_OVERDUE:
    case NotificationType.TASK_DAILY_DIGEST:
      return `/app/tasks/${id}`;
    case NotificationType.INVOICE_OVERDUE:
    case NotificationType.CHEQUE_MATURITY_DUE:
      return `/app/invoices/${id}`;
    case NotificationType.DOCUMENT_INDEXED:
    case NotificationType.RESEARCH_COMPLETE:
      return `/app/documents/${id}`;
    default:
      return null;
  }
}

export function NotificationsPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["type", "isRead"]
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notifications-full", table.state],
    queryFn: () => apiFetch<NotificationListResponseDto>(`/api/notifications?${table.toApiQueryString()}`)
  });
  const unreadCountQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => apiFetch<{ count: number }>("/api/notifications/unread-count")
  });

  const markAll = useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      feedback.success("messages.notificationsUpdated");
      void qc.invalidateQueries({ queryKey: ["notifications-full"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  const markOne = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      feedback.success("messages.notificationMarkedRead");
      void qc.invalidateQueries({ queryKey: ["notifications-full"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    }
  });

  const unread = unreadCountQuery.data?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
        stickyActions
        actions={
          unread > 0 ? (
            <button
              onClick={() => void markAll.mutateAsync()}
              disabled={markAll.isPending}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
            >
              {t("notifications.markAllRead")}
            </button>
          ) : undefined
        }
      />

      <SectionCard title={t("notifications.all")}>
        <TableToolbar
          primaryChildren={
            <>
          <Field
            label={t("labels.search")}
            value={table.state.q}
            onChange={table.setQ}
            placeholder={t("notifications.searchPlaceholder")}
          />
          <SelectField
            label={t("labels.type")}
            value={table.state.filters.type ?? ""}
            onChange={(value) => table.setFilter("type", value)}
            options={[
              { value: "", label: t("labels.all") },
              ...Object.values(NotificationType).map((value) => ({ value, label: value }))
            ]}
          />
        </>
          }
          secondaryChildren={
            <div className="max-w-xs">
              <SelectField
                label={t("labels.status")}
              value={table.state.filters.isRead ?? ""}
              onChange={(value) => table.setFilter("isRead", value)}
              options={[
                { value: "", label: t("labels.all") },
                { value: "false", label: t("notifications.unread") },
                { value: "true", label: t("notifications.read") }
              ]}
            />
            </div>
          }
          secondaryLabel={t("actions.more")}
        />
        {isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && !data?.items.length && (
          <EmptyState title={t("notifications.empty")} description="" />
        )}
        {!isLoading && !isError && !!data?.items.length && (
          <>
            <ResponsiveDataList
              items={data.items}
              getItemKey={(item) => item.id}
              fields={[
                { key: "title", label: t("labels.title"), render: (item) => <span className={!item.isRead ? "font-semibold" : ""}>{item.title}</span> },
                { key: "description", label: t("labels.description"), render: (item) => item.body },
                { key: "date", label: t("labels.date"), render: (item) => formatDateTime(item.createdAt) },
                { key: "status", label: t("labels.status"), render: (item) => (item.isRead ? t("notifications.read") : t("notifications.unread")) }
              ]}
              actions={(item) =>
                !item.isRead ? (
                  <button
                    onClick={() => void markOne.mutateAsync(item.id)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-accent hover:bg-blue-50"
                  >
                    {t("notifications.markRead")}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )
              }
            />
            <TableWrapper mobileMode="cards">
              <DataTable>
                <TableHead>
                  <tr>
                    <SortableTableHeadCell label={t("labels.title")} sortKey="title" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <TableHeadCell>{t("labels.description")}</TableHeadCell>
                    <SortableTableHeadCell label={t("labels.date")} sortKey="createdAt" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <SortableTableHeadCell label={t("labels.status")} sortKey="isRead" sortBy={table.state.sortBy} sortDir={table.state.sortDir} onSort={table.setSort} />
                    <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {data.items.map((n) => {
                    const path = resolveNotificationPath(n);
                    return (
                    <TableRow key={n.id}>
                      <TableCell>
                        {path ? (
                          <button
                            className={`text-start hover:text-accent hover:underline ${!n.isRead ? "font-semibold" : ""}`}
                            onClick={() => { void markOne.mutateAsync(n.id); void navigate({ to: path }); }}
                            type="button"
                          >
                            {n.title}
                          </button>
                        ) : (
                          <span className={!n.isRead ? "font-semibold" : ""}>{n.title}</span>
                        )}
                      </TableCell>
                      <TableCell>{n.body}</TableCell>
                      <TableCell>{formatDateTime(n.createdAt)}</TableCell>
                      <TableCell>{n.isRead ? t("notifications.read") : t("notifications.unread")}</TableCell>
                      <TableCell align="end">
                        {!n.isRead ? (
                          <button
                            onClick={() => void markOne.mutateAsync(n.id)}
                            className="ms-3 shrink-0 rounded-lg px-2 py-1 text-xs text-accent hover:bg-blue-100"
                          >
                            {t("notifications.markRead")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            </TableWrapper>
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={data.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}
