import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import type { DocumentSearchResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { EmptyState, ErrorState, PageHeader } from "./ui";
import { SearchResultCard } from "../../components/search/SearchResultCard";

export function SearchPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { q } = useSearch({ from: "/app/search" });
  const normalizedQuery = q.trim();
  const [draftQuery, setDraftQuery] = useState(q);

  useEffect(() => {
    setDraftQuery(q);
  }, [q]);

  const searchQuery = useQuery({
    queryKey: ["document-search", normalizedQuery],
    queryFn: () =>
      apiFetch<DocumentSearchResponseDto>(
        `/api/search/documents?q=${encodeURIComponent(normalizedQuery)}`
      ),
    enabled: normalizedQuery.length > 0
  });

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    void navigate({
      to: "/app/search",
      search: { q: nextQuery }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("search.description")}
        eyebrow={t("search.eyebrow")}
        title={normalizedQuery ? `"${normalizedQuery}"` : t("search.title")}
      />

      <form className="flex gap-3" onSubmit={submitSearch}>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label={t("search.placeholder")}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 ps-9 pe-4 text-sm outline-none focus:border-accent"
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            type="search"
            value={draftQuery}
          />
        </div>
        <button
          className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!draftQuery.trim()}
          type="submit"
        >
          {t("actions.search")}
        </button>
      </form>

      {searchQuery.isLoading ? (
        <p className="text-sm text-slate-500">...</p>
      ) : searchQuery.isError ? (
        <ErrorState
          title={t("errors.title")}
          description={
            (searchQuery.error as Error)?.message ?? t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void searchQuery.refetch()}
        />
      ) : searchQuery.data?.items.length === 0 || !normalizedQuery ? (
        <EmptyState
          description={
            normalizedQuery
              ? t("search.noResultsHelp")
              : t("search.placeholder")
          }
          title={normalizedQuery ? t("search.noResults") : t("search.title")}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {searchQuery.data?.total ?? 0} {t("search.rankLabel")}
          </p>
          {searchQuery.data?.items.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
