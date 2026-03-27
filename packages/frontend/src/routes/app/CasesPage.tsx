import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { CaseListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { DataTable, EmptyState, ErrorState, PageHeader, SectionCard, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TableWrapper } from "./ui";

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
        {casesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={(casesQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void casesQuery.refetch()}
          />
        ) : !casesQuery.data?.items.length ? (
          <EmptyState title={t("empty.noCases")} description={t("empty.noCasesHelp")} />
        ) : (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("labels.title")}</TableHeadCell>
                  <TableHeadCell>{t("labels.caseNumber")}</TableHeadCell>
                  <TableHeadCell>{t("labels.status")}</TableHeadCell>
                  <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {casesQuery.data.items.map((caseItem) => (
                  <TableRow key={caseItem.id}>
                    <TableCell>{caseItem.title}</TableCell>
                    <TableCell>{caseItem.caseNumber}</TableCell>
                    <TableCell>{getEnumLabel(t, "CaseStatus", caseItem.status)}</TableCell>
                    <TableCell align="end">
                      <Link
                        className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        key={caseItem.id}
                        params={{ caseId: caseItem.id }}
                        to="/app/cases/$caseId"
                      >
                        {t("actions.viewDocument")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrapper>
        )}
      </SectionCard>
    </div>
  );
}
