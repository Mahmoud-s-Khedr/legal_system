import type { DocumentSearchResultDto } from "@elms/shared";
import { formatDateTime } from "../../routes/app/ui";

interface SearchResultCardProps {
  result: DocumentSearchResultDto;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
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
      {result.headline ? (
        <p
          className="text-sm text-slate-600 leading-relaxed [&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5"
          dangerouslySetInnerHTML={{ __html: result.headline }}
        />
      ) : null}
      <p className="text-xs text-slate-400">{formatDateTime(result.createdAt)}</p>
    </div>
  );
}
