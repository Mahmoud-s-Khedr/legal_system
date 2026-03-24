import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { CaseListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { EmptyState, PageHeader, SectionCard } from "./ui";

export function CasesPage() {
  const { t } = useTranslation("app");

  const casesQuery = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases")
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("cases.eyebrow")}
        title={t("cases.title")}
        description={t("cases.description")}
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/cases/new"
          >
            {t("actions.newCase")}
          </Link>
        }
      />
      <SectionCard title={t("cases.directory")} description={t("cases.directoryHelp")}>
        {!casesQuery.data?.items.length ? (
          <EmptyState title={t("empty.noCases")} description={t("empty.noCasesHelp")} />
        ) : (
          <div className="space-y-3">
            {casesQuery.data.items.map((caseItem) => (
              <Link
                className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent"
                key={caseItem.id}
                params={{ caseId: caseItem.id }}
                to="/app/cases/$caseId"
              >
                <p className="font-semibold">{caseItem.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {caseItem.caseNumber} · {getEnumLabel(t, "CaseStatus", caseItem.status)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
