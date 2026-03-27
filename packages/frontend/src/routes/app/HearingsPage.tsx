import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { HearingListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  SelectField,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TableWrapper,
  formatDateTime
} from "./ui";

export function HearingsPage() {
  const { t } = useTranslation("app");
  const [overdue, setOverdue] = useState("");

  const hearingsQuery = useQuery({
    queryKey: ["hearings-management", overdue],
    queryFn: () =>
      apiFetch<HearingListResponseDto>(
        overdue ? `/api/hearings?overdue=${encodeURIComponent(overdue)}` : "/api/hearings"
      )
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("hearings.eyebrow")}
        title={t("hearings.title")}
        description={t("hearings.description")}
        actions={
          <Link className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white" to="/app/hearings/new">
            {t("hearings.newHearing")}
          </Link>
        }
      />

      <SectionCard title={t("hearings.title")} description={t("hearings.description")}>
        <div className="mb-4 max-w-xs">
          <SelectField
            label={t("labels.status")}
            value={overdue}
            onChange={setOverdue}
            options={[
              { value: "", label: t("labels.all") },
              { value: "true", label: t("tasks.overdue") }
            ]}
          />
        </div>

        {hearingsQuery.isLoading ? <p className="text-sm text-slate-500">{t("labels.loading")}</p> : null}

        {hearingsQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={(hearingsQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void hearingsQuery.refetch()}
          />
        ) : null}

        {!hearingsQuery.isLoading && !hearingsQuery.isError && !hearingsQuery.data?.items.length ? (
          <EmptyState title={t("empty.noHearings")} description={t("empty.noHearingsHelp")} />
        ) : null}

        {!hearingsQuery.isLoading && !hearingsQuery.isError && !!hearingsQuery.data?.items.length ? (
          <TableWrapper>
            <DataTable>
              <TableHead>
                <tr>
                  <TableHeadCell>{t("labels.case")}</TableHeadCell>
                  <TableHeadCell>{t("labels.sessionDatetime")}</TableHeadCell>
                  <TableHeadCell>{t("labels.assignedLawyer")}</TableHeadCell>
                  <TableHeadCell>{t("labels.outcome")}</TableHeadCell>
                  <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {hearingsQuery.data.items.map((hearing) => (
                  <TableRow key={hearing.id}>
                    <TableCell>{hearing.caseTitle}</TableCell>
                    <TableCell>{formatDateTime(hearing.sessionDatetime)}</TableCell>
                    <TableCell>{hearing.assignedLawyerName ?? t("labels.unassigned")}</TableCell>
                    <TableCell>{hearing.outcome ?? "—"}</TableCell>
                    <TableCell align="end">
                      <Link
                        className="inline-flex rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        params={{ hearingId: hearing.id }}
                        to="/app/hearings/$hearingId/edit"
                      >
                        {t("actions.edit")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrapper>
        ) : null}
      </SectionCard>
    </div>
  );
}
