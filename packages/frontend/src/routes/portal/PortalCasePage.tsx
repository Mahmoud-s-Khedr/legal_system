import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Calendar } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  formatDate
} from "../app/ui";
import { resolveApiUrl } from "../../lib/api";

interface PortalCaseDetail {
  id: string;
  title: string;
  caseNumber: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  courts: Array<{
    id: string;
    courtName: string;
    courtLevel: string;
    caseNumber?: string;
  }>;
  hearings: Array<{
    id: string;
    sessionDatetime: string;
    nextSessionAt: string | null;
    outcome: string | null;
  }>;
  lawyers: Array<{ fullName: string; role: string }>;
}

class PortalRequestError extends Error {
  status: number;
  constructor(status: number) {
    super(`request_failed_${status}`);
    this.status = status;
  }
}

async function portalFetch<T>(url: string): Promise<T> {
  const res = await fetch(resolveApiUrl(url), { credentials: "include" });
  if (!res.ok) throw new PortalRequestError(res.status);
  return res.json() as Promise<T>;
}

export function PortalCasePage() {
  const { t } = useTranslation("app");
  const { caseId } = useParams({ strict: false }) as { caseId: string };

  const caseQuery = useQuery({
    queryKey: ["portal-case", caseId],
    queryFn: () => portalFetch<PortalCaseDetail>(`/api/portal/cases/${caseId}`)
  });

  const c = caseQuery.data;

  if (caseQuery.isLoading) {
    return (
      <div className="py-16 text-center text-slate-400">
        {t("labels.loading")}
      </div>
    );
  }

  if (caseQuery.isError) {
    const error = caseQuery.error as Error;
    const status = error instanceof PortalRequestError ? error.status : null;
    return (
      <div className="p-6">
        <ErrorState
          title={status === 404 ? t("errors.notFound") : t("errors.title")}
          description={
            status === 404
              ? t("errors.notFound")
              : status === 401 || status === 403
                ? t("errors.unauthorized")
                : error.message || t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void caseQuery.refetch()}
        />
      </div>
    );
  }

  if (!c) {
    return (
      <div className="py-16 text-center text-slate-400">
        {t("errors.notFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.title}
        description={`${c.caseNumber} · ${c.type} · ${c.status}`}
        actions={
          <Link
            className="mb-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-accent hover:text-accent"
            to="/portal/dashboard"
          >
            <ArrowLeft className="size-4" />
            {t("portal.backToDashboard")}
          </Link>
        }
      />

      {/* Assigned lawyers */}
      {c.lawyers.length > 0 ? (
        <SectionCard title={t("portal.assignedLawyers")}>
          <div className="space-y-2">
            {c.lawyers.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5"
              >
                <span className="font-medium">{l.fullName}</span>
                <span className="text-sm text-slate-400">{l.role}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* Courts */}
      {c.courts.length > 0 ? (
        <SectionCard title={t("cases.courts")}>
          <div className="space-y-2">
            {c.courts.map((court) => (
              <div
                key={court.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5"
              >
                <p className="font-medium">{court.courtName}</p>
                <p className="text-sm text-slate-500">
                  {court.courtLevel}
                  {court.caseNumber && ` · ${court.caseNumber}`}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* Hearings */}
      <SectionCard title={t("portal.hearings")}>
        {!c.hearings.length ? (
          <EmptyState
            title={t("empty.noHearings")}
            description={t("empty.noHearingsHelp")}
          />
        ) : (
          <div className="space-y-2">
            {c.hearings.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <Calendar className="size-5 text-slate-400" />
                <div className="flex-1">
                  <p className="font-medium">{formatDate(h.sessionDatetime)}</p>
                  {h.outcome && (
                    <p className="text-sm text-slate-500">{h.outcome}</p>
                  )}
                </div>
                {h.nextSessionAt ? (
                  <p className="text-sm text-slate-400">
                    {t("hearings.next")}: {formatDate(h.nextSessionAt)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
