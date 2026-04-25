import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { EmptyState, ErrorState, PageHeader } from "./ui";
import { GlobalSearchResultCard } from "../../components/search/GlobalSearchResultCard";

interface GlobalSearchResult {
  entityType: string;
  id: string;
  title: string;
  snippet: string | null;
  url: string;
  rank: number;
}

export function SearchPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { q } = useSearch({ from: "/app/search" });
  const normalizedQuery = q.trim();
  const [draftQuery, setDraftQuery] = useState(q);

  useEffect(() => {
    setDraftQuery(q);
  }, [q]);

  const searchQuery = useQuery<GlobalSearchResult[]>({
    queryKey: ["global-search", normalizedQuery],
    queryFn: () =>
      apiFetch<GlobalSearchResult[]>(
        `/api/search/global?q=${encodeURIComponent(normalizedQuery)}`
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
      ) : searchQuery.data?.length === 0 || !normalizedQuery ? (
        <EmptyState
          description={
            normalizedQuery
              ? t("search.noResultsHelp")
              : t("search.placeholder")
          }
          title={normalizedQuery ? t("search.noResults") : t("search.title")}
        />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            {searchQuery.data?.length ?? 0} {t("search.rankLabel")}
          </p>
          <div className="space-y-4">
            {groupByEntityType(searchQuery.data ?? []).map(
              ([entityType, items]) => (
                <div key={entityType} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 capitalize">
                    {t(`search.entity.${entityType}`, { defaultValue: entityType })}
                  </h3>
                  <div className="grid gap-2">
                    {items.map((result) => (
                      <GlobalSearchResultCard
                        key={`${result.entityType}-${result.id}`}
                        result={result}
                        highlightQuery={normalizedQuery}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function groupByEntityType(
  results: GlobalSearchResult[]
): Array<[string, GlobalSearchResult[]]> {
  const groups = new Map<string, GlobalSearchResult[]>();
  for (const result of results) {
    const list = groups.get(result.entityType) ?? [];
    list.push(result);
    groups.set(result.entityType, list);
  }
  return Array.from(groups.entries());
}
