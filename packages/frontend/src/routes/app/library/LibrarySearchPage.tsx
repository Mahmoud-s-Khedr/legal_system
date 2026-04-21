import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LibraryDocumentType } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { Select } from "antd";
import { Search, BookOpen } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { EmptyState, ErrorState, PageHeader, selectLabelFilter } from "../ui";

interface SearchResult {
  id: string;
  title: string;
  type: string;
  snippet: string | null;
  kind: "document" | "article";
  documentId: string;
}

export function LibrarySearchPage() {
  const { t } = useTranslation("app");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const searchQuery = useQuery({
    enabled: submitted.length > 0,
    queryKey: ["library-search", submitted, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ q: submitted });
      if (typeFilter) params.set("type", typeFilter);
      return apiFetch<{ results: SearchResult[] }>(
        `/api/library/search?${params.toString()}`
      );
    }
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) setSubmitted(query.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("library.searchDescription")}
        eyebrow={t("library.eyebrow")}
        title={t("library.searchTitle")}
      />

      <form className="flex gap-3" onSubmit={handleSearch}>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label={t("library.searchPlaceholder")}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 ps-9 pe-4 text-sm outline-none focus:border-accent"
            placeholder={t("library.searchPlaceholder")}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          aria-label={t("library.filterByType")}
          className="elms-select"
          style={{ minWidth: 220 }}
          value={typeFilter}
          onChange={(value) => setTypeFilter(value)}
          options={[
            { value: "", label: t("library.allTypes") },
            {
              value: LibraryDocumentType.LEGISLATION,
              label: t("library.types.legislation")
            },
            {
              value: LibraryDocumentType.JUDGMENT,
              label: t("library.types.judgment")
            },
            {
              value: LibraryDocumentType.PRACTICE_GUIDE,
              label: t("library.types.practiceGuide")
            },
            {
              value: LibraryDocumentType.ARTICLE,
              label: t("library.types.article")
            },
            {
              value: LibraryDocumentType.COMMENTARY,
              label: t("library.types.commentary")
            },
            {
              value: LibraryDocumentType.GENERAL,
              label: t("common.documentType.GENERAL")
            }
          ]}
          showSearch
          filterOption={(input, option) => selectLabelFilter(input, option)}
          optionFilterProp="label"
          classNames={{ popup: { root: "elms-select-dropdown" } }}
        />
        <button
          className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!query.trim()}
          type="submit"
        >
          {t("actions.search")}
        </button>
      </form>

      {searchQuery.isLoading && (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      )}
      {searchQuery.isError && (
        <ErrorState
          title={t("errors.title")}
          description={
            (searchQuery.error as Error)?.message ?? t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void searchQuery.refetch()}
        />
      )}

      {searchQuery.data &&
        !searchQuery.isError &&
        !searchQuery.data.results.length && (
          <EmptyState
            description={t("empty.noResultsHelp")}
            title={t("empty.noResults")}
          />
        )}

      {searchQuery.data?.results &&
        !searchQuery.isError &&
        searchQuery.data.results.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {t("library.resultsCount", {
                count: searchQuery.data.results.length
              })}
            </p>
            {searchQuery.data.results.map((result) => (
              <Link
                className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-accent"
                key={`${result.kind}-${result.id}`}
                params={{ documentId: result.documentId }}
                to="/app/library/documents/$documentId"
              >
                <BookOpen
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-accent"
                />
                <div className="min-w-0">
                  <p className="font-semibold">{result.title}</p>
                  <p className="mt-0.5 text-xs font-medium text-accent">
                    {result.type}
                  </p>
                  {result.snippet && (
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                      {result.snippet}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
