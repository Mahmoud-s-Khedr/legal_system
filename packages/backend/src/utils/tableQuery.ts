import { z } from "zod";
import { stringMatchesFuzzyQuery } from "./fuzzySearch.js";

export const sortDirSchema = z.enum(["asc", "desc"]);
export type SortDir = z.infer<typeof sortDirSchema>;

const sharedListQuerySchema = z.object({
  q: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: sortDirSchema.optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

export interface SharedListQuery {
  q?: string;
  sortBy?: string;
  sortDir: SortDir;
  page: number;
  limit: number;
}

export function parseSharedListQuery(
  query: Record<string, string | undefined>,
  defaults: { page?: number; limit?: number; sortDir?: SortDir } = {}
): SharedListQuery {
  const parsed = sharedListQuerySchema.parse(query);

  const pageDefault = defaults.page ?? 1;
  const limitDefault = defaults.limit ?? 50;

  const page = Math.max(1, Number.parseInt(parsed.page ?? String(pageDefault), 10) || pageDefault);
  const limit = Math.min(200, Math.max(1, Number.parseInt(parsed.limit ?? String(limitDefault), 10) || limitDefault));

  return {
    q: parsed.q?.trim() || undefined,
    sortBy: parsed.sortBy,
    sortDir: parsed.sortDir ?? defaults.sortDir ?? "desc",
    page,
    limit
  };
}

export function normalizeSort<TField extends string>(
  sortBy: string | undefined,
  allowed: readonly TField[],
  fallback: TField
): TField {
  if (!sortBy) {
    return fallback;
  }

  return (allowed as readonly string[]).includes(sortBy) ? (sortBy as TField) : fallback;
}

export function toPrismaSortOrder(sortDir: SortDir): "asc" | "desc" {
  return sortDir === "asc" ? "asc" : "desc";
}

export function paginateArray<T>(items: T[], page: number, limit: number) {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  const aDate = typeof a === "string" ? Date.parse(a) : Number.NaN;
  const bDate = typeof b === "string" ? Date.parse(b) : Number.NaN;
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return aDate - bDate;
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

export function applyArrayTableQuery<T extends Record<string, unknown>>(
  rows: T[],
  options: {
    q?: string;
    searchFields: Array<keyof T>;
    sortBy: keyof T;
    sortDir: SortDir;
    page: number;
    limit: number;
  }
) {
  const q = options.q?.trim();

  const filtered = q
    ? rows.filter((row) =>
        options.searchFields.some((field) =>
          stringMatchesFuzzyQuery(String(row[field] ?? ""), q)
        )
      )
    : rows;

  const sorted = [...filtered].sort((left, right) => {
    const base = compareValues(left[options.sortBy], right[options.sortBy]);
    return options.sortDir === "asc" ? base : -base;
  });

  return {
    total: sorted.length,
    items: paginateArray(sorted, options.page, options.limit)
  };
}
