import { useMemo } from "react";
import { useSearch } from "@tanstack/react-router";

export type SortDir = "asc" | "desc";

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getPositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(typeof value === "string" ? value : String(fallback), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, parsed);
}

function commitSearchParams(params: URLSearchParams, replace = true) {
  const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
  if (replace) {
    window.history.replaceState(window.history.state, "", url);
  } else {
    window.history.pushState(window.history.state, "", url);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export interface TableQueryState {
  q: string;
  sortBy: string;
  sortDir: SortDir;
  page: number;
  limit: number;
  filters: Record<string, string>;
}

export function useTableQueryState(options: {
  defaultSortBy: string;
  defaultSortDir?: SortDir;
  defaultPage?: number;
  defaultLimit?: number;
  filterKeys?: string[];
}) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;

  const defaultSortDir = options.defaultSortDir ?? "desc";
  const defaultPage = options.defaultPage ?? 1;
  const defaultLimit = options.defaultLimit ?? 20;
  const filterKeys = options.filterKeys ?? [];

  const state = useMemo<TableQueryState>(() => {
    const filters = Object.fromEntries(
      filterKeys.map((key) => [key, getString(search[key])])
    );
    return {
      q: getString(search.q),
      sortBy: getString(search.sortBy, options.defaultSortBy),
      sortDir: (getString(search.sortDir, defaultSortDir) === "asc" ? "asc" : "desc"),
      page: getPositiveInt(search.page, defaultPage),
      limit: getPositiveInt(search.limit, defaultLimit),
      filters
    };
  }, [defaultLimit, defaultPage, defaultSortDir, filterKeys, options.defaultSortBy, search]);

  function update(next: {
    q?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page?: number;
    limit?: number;
    filters?: Record<string, string | undefined>;
    replace?: boolean;
  }) {
    const params = new URLSearchParams(window.location.search);
    const q = next.q ?? state.q;
    const sortBy = next.sortBy ?? state.sortBy;
    const sortDir = next.sortDir ?? state.sortDir;
    const page = next.page ?? state.page;
    const limit = next.limit ?? state.limit;

    if (q.trim().length > 0) params.set("q", q.trim());
    else params.delete("q");

    if (sortBy) params.set("sortBy", sortBy);
    else params.delete("sortBy");

    params.set("sortDir", sortDir);
    params.set("page", String(Math.max(1, page)));
    params.set("limit", String(Math.max(1, limit)));

    for (const key of filterKeys) {
      const value = next.filters?.[key] ?? state.filters[key] ?? "";
      if (value && value.trim().length > 0) params.set(key, value);
      else params.delete(key);
    }

    commitSearchParams(params, next.replace ?? true);
  }

  function setQ(q: string) {
    update({ q, page: 1 });
  }

  function setFilter(key: string, value: string) {
    update({ filters: { [key]: value }, page: 1 });
  }

  function setSort(sortBy: string) {
    if (state.sortBy === sortBy) {
      update({ sortDir: state.sortDir === "asc" ? "desc" : "asc", page: 1 });
      return;
    }
    update({ sortBy, sortDir: "asc", page: 1 });
  }

  function setPage(page: number) {
    update({ page });
  }

  function setLimit(limit: number) {
    update({ limit, page: 1 });
  }

  function toApiQueryString(extra: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    if (state.q.trim().length > 0) params.set("q", state.q.trim());
    params.set("sortBy", state.sortBy);
    params.set("sortDir", state.sortDir);
    params.set("page", String(state.page));
    params.set("limit", String(state.limit));
    for (const [key, value] of Object.entries(state.filters)) {
      if (value.trim().length > 0) {
        params.set(key, value);
      }
    }
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined && String(value).trim().length > 0) {
        params.set(key, String(value));
      }
    }
    return params.toString();
  }

  return {
    state,
    setQ,
    setFilter,
    setSort,
    setPage,
    setLimit,
    update,
    toApiQueryString
  };
}

