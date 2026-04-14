import type { DocumentSearchResultDto } from "@elms/shared";
import { Fragment } from "react";
import { formatDateTime } from "../../routes/app/ui";

interface SearchResultCardProps {
  result: DocumentSearchResultDto;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const headlineParts = splitHeadlineByMark(result.headline);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{result.title}</p>
          <p className="text-xs text-slate-500">{result.fileName}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="rounded-full bg-accentSoft px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
            {result.type}
          </span>
        </div>
      </div>
      {headlineParts.length > 0 ? (
        <p className="text-sm text-slate-600 leading-relaxed">
          {headlineParts.map((part, index) =>
            part.highlight ? (
              <mark key={`mark-${index}`} className="rounded bg-yellow-200 px-0.5">
                {part.text}
              </mark>
            ) : (
              <Fragment key={`text-${index}`}>{part.text}</Fragment>
            )
          )}
        </p>
      ) : null}
      <p className="text-xs text-slate-400">{formatDateTime(result.createdAt)}</p>
    </div>
  );
}

interface HeadlinePart {
  text: string;
  highlight: boolean;
}

function splitHeadlineByMark(headline: string): HeadlinePart[] {
  if (!headline.trim()) {
    return [];
  }

  const tokens = headline.split(/(<mark>|<\/mark>)/gi);
  const parts: HeadlinePart[] = [];
  let highlight = false;

  for (const token of tokens) {
    if (!token) {
      continue;
    }
    if (/^<mark>$/i.test(token)) {
      highlight = true;
      continue;
    }
    if (/^<\/mark>$/i.test(token)) {
      highlight = false;
      continue;
    }

    parts.push({ text: token, highlight });
  }

  return parts;
}
