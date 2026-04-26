import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

interface GlobalSearchResult {
  entityType: string;
  id: string;
  title: string;
  snippet: string | null;
  url: string;
  rank: number;
}

interface GlobalSearchResultCardProps {
  result: GlobalSearchResult;
  highlightQuery?: string;
}

export function GlobalSearchResultCard({
  result,
  highlightQuery
}: GlobalSearchResultCardProps) {
  const { t } = useTranslation("app");

  return (
    <Link
      to={result.url as never}
      className="block rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {highlightText(result.title, highlightQuery)}
          </p>
          {result.snippet ? (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {result.snippet}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-accentSoft px-2.5 py-0.5 text-xs font-semibold text-emerald-900 capitalize">
          {t(`search.entity.${result.entityType}`, { defaultValue: result.entityType })}
        </span>
      </div>
    </Link>
  );
}

function highlightText(text: string, query?: string) {
  if (!query || !query.trim()) return text;
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  const parts: { text: string; highlight: boolean }[] = [];
  let lastIndex = 0;

  // Simple highlight: find all occurrences of query (case-insensitive)
  let idx = normalizedText.indexOf(normalizedQuery, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), highlight: false });
    }
    parts.push({
      text: text.slice(idx, idx + query.length),
      highlight: true
    });
    lastIndex = idx + query.length;
    idx = normalizedText.indexOf(normalizedQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  if (parts.length === 0) {
    parts.push({ text, highlight: false });
  }

  return parts.map((part, i) =>
    part.highlight ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5">
        {part.text}
      </mark>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    )
  );
}
