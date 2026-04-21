import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useTableQueryState } from "../../lib/tableQueryState";
import {
  ErrorState,
  Field,
  PageHeader,
  SectionCard,
  SelectField,
  TableToolbar
} from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { getEnumLabel } from "../../lib/enumLabel";
import { useLookupOptions } from "../../lib/lookups";

export function DocumentsPage() {
  const { t } = useTranslation("app");
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["type"]
  });
  const docTypesQuery = useLookupOptions("DocumentType");

  const queryKey = [
    "documents",
    table.state.q,
    table.state.filters.type,
    table.state.sortBy,
    table.state.sortDir,
    table.state.page,
    table.state.limit
  ];

  const typeOptions = [
    { value: "", label: t("labels.all") },
    ...(docTypesQuery.data?.items ?? []).map((o) => ({
      value: o.key,
      label: getEnumLabel(t, "DocumentType", o.key)
    }))
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
            to="/app/documents/new"
          >
            {t("actions.uploadNew")}
          </Link>
        }
        description={t("documents.description")}
        eyebrow={t("documents.eyebrow")}
        title={t("documents.title")}
      />
      <SectionCard
        description={t("documents.listHelp")}
        title={t("documents.list")}
      >
        {docTypesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (docTypesQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void docTypesQuery.refetch()}
          />
        ) : null}
        <TableToolbar>
          <Field
            label={t("labels.search")}
            value={table.state.q}
            onChange={table.setQ}
            placeholder={t("documents.searchPlaceholder")}
          />
          <SelectField
            label={t("documents.fileType")}
            onChange={(value) => table.setFilter("type", value)}
            options={typeOptions}
            value={table.state.filters.type ?? ""}
          />
        </TableToolbar>
        <div className="mb-4 max-w-xs">
          <SelectField
            label={t("labels.sort")}
            value={`${table.state.sortBy}:${table.state.sortDir}`}
            onChange={(value) => {
              const [sortBy, sortDir] = value.split(":");
              table.update({
                sortBy,
                sortDir: sortDir as "asc" | "desc",
                page: 1
              });
            }}
            options={[
              { value: "createdAt:desc", label: `${t("labels.date")} ↓` },
              { value: "createdAt:asc", label: `${t("labels.date")} ↑` },
              { value: "title:asc", label: `${t("labels.documentTitle")} A-Z` },
              { value: "title:desc", label: `${t("labels.documentTitle")} Z-A` }
            ]}
          />
        </div>
        <DocumentList
          queryKey={queryKey}
          queryParams={{
            q: table.state.q || undefined,
            type: table.state.filters.type || undefined,
            sortBy: table.state.sortBy,
            sortDir: table.state.sortDir,
            page: table.state.page,
            limit: table.state.limit
          }}
          pagination={{
            page: table.state.page,
            pageSize: table.state.limit,
            onPageChange: table.setPage,
            onPageSizeChange: table.setLimit
          }}
        />
      </SectionCard>
    </div>
  );
}
