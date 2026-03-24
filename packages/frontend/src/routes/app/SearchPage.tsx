import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { DocumentSearchResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { EmptyState, PageHeader } from "./ui";
import { SearchResultCard } from "../../components/search/SearchResultCard";

export function SearchPage() {
  const { t } = useTranslation("app");
  const { q = "" } = useSearch({ strict: false }) as { q?: string };

  const searchQuery = useQuery({
    queryKey: ["document-search", q],
    queryFn: () =>
      apiFetch<DocumentSearchResponseDto>(
        `/api/search/documents?q=${encodeURIComponent(q)}`
      ),
    enabled: q.trim().length > 0
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("search.description")}
        eyebrow={t("search.eyebrow")}
        title={q ? `"${q}"` : t("search.title")}
      />

      {searchQuery.isLoading ? (
        <p className="text-sm text-slate-500">...</p>
      ) : searchQuery.data?.items.length === 0 || !q ? (
        <EmptyState
          description={q ? t("search.noResultsHelp") : t("search.placeholder")}
          title={q ? t("search.noResults") : t("search.title")}
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
