import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NotificationListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { useAccessibleOverlay } from "../shared/useAccessibleOverlay";

export function NotificationBell() {
  const { t } = useTranslation("app");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const closePanel = useCallback(() => setOpen(false), []);

  useAccessibleOverlay({
    open,
    mode: "popover",
    contentRef: panelRef,
    triggerRef,
    onClose: closePanel
  });

  const countQuery = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => apiFetch<{ count: number }>("/api/notifications/unread-count"),
    refetchInterval: 60_000 // poll every 60s
  });

  const listQuery = useQuery({
    queryKey: ["notifications-list"],
    queryFn: () => apiFetch<NotificationListResponseDto>("/api/notifications?limit=10"),
    enabled: open
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-count"] });
      void qc.invalidateQueries({ queryKey: ["notifications-list"] });
    }
  });

  const markAllRead = useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications-count"] });
      void qc.invalidateQueries({ queryKey: ["notifications-list"] });
    }
  });

  const unreadCount = countQuery.data?.count ?? 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
        aria-label={`${t("notifications.title")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notifications-panel"
        type="button"
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute end-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown */}
          <div
            id="notifications-panel"
            ref={panelRef}
            tabIndex={-1}
            className="absolute end-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-elevated"
            role="dialog"
            aria-labelledby="notifications-heading"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold" id="notifications-heading">{t("notifications.title")}</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllRead.mutateAsync()}
                  className="text-xs text-accent hover:underline"
                  aria-label={t("notifications.markAllRead")}
                >
                  {t("notifications.markAllRead")}
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {listQuery.isLoading && (
                <p className="px-4 py-3 text-sm text-slate-500">{t("labels.loading")}</p>
              )}
              {!listQuery.isLoading && !listQuery.data?.items.length && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">{t("notifications.empty")}</p>
              )}
              {listQuery.data?.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => void markRead.mutateAsync(n.id)}
                  className={`w-full px-4 py-3 text-start transition hover:bg-slate-50 ${
                    n.isRead ? "opacity-60" : ""
                  }`}
                >
                  <p className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                  {!n.isRead && (
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
