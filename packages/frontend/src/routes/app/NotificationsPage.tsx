import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { NotificationListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { useMutationFeedback } from "../../lib/feedback";
import { EmptyState, ErrorState, PageHeader, SectionCard, formatDateTime } from "./ui";

export function NotificationsPage() {
  const { t } = useTranslation("app");
  const qc = useQueryClient();
  const feedback = useMutationFeedback();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notifications-full"],
    queryFn: () => apiFetch<NotificationListResponseDto>("/api/notifications")
  });

  const markAll = useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      feedback.success("messages.notificationsUpdated");
      void qc.invalidateQueries({ queryKey: ["notifications-full"] });
    }
  });

  const markOne = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      feedback.success("messages.notificationMarkedRead");
      void qc.invalidateQueries({ queryKey: ["notifications-full"] });
    }
  });

  const unread = data?.items.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
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
          <div className="space-y-2">
            {data.items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start justify-between rounded-2xl border px-4 py-3 ${
                  n.isRead ? "border-slate-100 bg-white opacity-70" : "border-accent/30 bg-blue-50"
                }`}
              >
                <div>
                  <p className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {!n.isRead && (
                  <button
                    onClick={() => void markOne.mutateAsync(n.id)}
                    className="ms-3 shrink-0 rounded-lg px-2 py-1 text-xs text-accent hover:bg-blue-100"
                  >
                    {t("notifications.markRead")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
