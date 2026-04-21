import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SectionCard,
  formatDate
} from "../ui";

interface SessionSummary {
  id: string;
  title: string | null;
  caseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function ResearchPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [showForm, setShowForm] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["research-sessions"],
    queryFn: () => apiFetch<SessionSummary[]>("/api/research/sessions")
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      apiFetch<{ id: string }>("/api/research/sessions", {
        method: "POST",
        body: JSON.stringify({ title: title || undefined })
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["research-sessions"] });
      await navigate({
        to: "/app/research/$sessionId",
        params: { sessionId: data.id }
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/api/research/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["research-sessions"] });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("research.description")}
        eyebrow={t("research.eyebrow")}
        title={t("research.title")}
        actions={
          <PrimaryButton onClick={() => setShowForm(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t("research.newSession")}
          </PrimaryButton>
        }
      />

      {showForm && (
        <SectionCard title={t("research.newSession")}>
          <div className="flex gap-3">
            <input
              autoFocus
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder={t("research.sessionTitlePlaceholder")}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createMutation.mutate(newTitle.trim());
              }}
            />
            <PrimaryButton
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(newTitle.trim())}
            >
              {t("actions.create")}
            </PrimaryButton>
            <button
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              onClick={() => setShowForm(false)}
            >
              {t("actions.cancel")}
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard
        description={t("research.sessionsHelp")}
        title={t("research.sessions")}
      >
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        ) : sessionsQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (sessionsQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void sessionsQuery.refetch()}
          />
        ) : !sessionsQuery.data?.length ? (
          <EmptyState
            description={t("empty.noSessionsHelp")}
            title={t("empty.noSessions")}
          />
        ) : (
          <div className="space-y-2">
            {sessionsQuery.data.map((session) => (
              <div
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent/50"
                key={session.id}
              >
                <MessageSquare
                  aria-hidden="true"
                  className="size-5 shrink-0 text-accent"
                />
                <Link
                  className="flex-1 font-semibold hover:text-accent"
                  params={{ sessionId: session.id }}
                  to="/app/research/$sessionId"
                >
                  {session.title ?? t("research.untitledSession")}
                </Link>
                <span className="text-xs text-slate-400">
                  {formatDate(session.updatedAt)}
                </span>
                <button
                  aria-label={t("actions.delete")}
                  className="rounded-lg p-1 text-slate-400 hover:text-red-500"
                  onClick={() => deleteMutation.mutate(session.id)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
