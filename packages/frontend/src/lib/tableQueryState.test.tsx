import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parsePositiveIntSearchParam,
  useTableQueryState
} from "./tableQueryState";

let mockedSearch: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => mockedSearch
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

type TableHook = ReturnType<typeof useTableQueryState>;
let latestTable: TableHook | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultPage: 1,
    defaultLimit: 20
  });
  latestTable = table;
  return null;
}

function renderProbe() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Probe />);
  });
}

function setMockedSearchFromUrlWithNumericPageAndLimit() {
  const params = new URLSearchParams(window.location.search);
  const limit = params.get("limit");
  const page = params.get("page");
  mockedSearch = {
    q: params.get("q") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") ?? undefined,
    page: page ? Number.parseInt(page, 10) : undefined,
    limit: limit ? Number.parseInt(limit, 10) : undefined
  };
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  latestTable = null;
});

beforeEach(() => {
  window.history.replaceState({}, "", "/app/clients");
  mockedSearch = {};
});

describe("parsePositiveIntSearchParam", () => {
  it("preserves limit/page values passed as string", () => {
    expect(parsePositiveIntSearchParam("50", 20)).toBe(50);
    expect(parsePositiveIntSearchParam("3", 1)).toBe(3);
  });

  it("preserves limit/page values passed as number", () => {
    expect(parsePositiveIntSearchParam(50, 20)).toBe(50);
    expect(parsePositiveIntSearchParam(3, 1)).toBe(3);
  });

  it("falls back for invalid values", () => {
    expect(parsePositiveIntSearchParam("invalid", 20)).toBe(20);
    expect(parsePositiveIntSearchParam("", 20)).toBe(20);
    expect(parsePositiveIntSearchParam(null, 20)).toBe(20);
  });
});

describe("useTableQueryState", () => {
  it("keeps selected limit after setLimit when router search provides numeric values", () => {
    mockedSearch = {
      sortBy: "createdAt",
      sortDir: "desc",
      page: 1,
      limit: 20
    };
    renderProbe();

    expect(latestTable?.state.limit).toBe(20);
    act(() => {
      latestTable?.setLimit(50);
    });

    setMockedSearchFromUrlWithNumericPageAndLimit();
    act(() => {
      root?.render(<Probe />);
    });

    expect(latestTable?.state.limit).toBe(50);
    expect(latestTable?.state.page).toBe(1);
  });
});
