import { describe, expect, it } from "vitest";
import { parsePaginationQuery, parseSearchPaginationQuery } from "./pagination.js";

describe("parsePaginationQuery", () => {
  it("returns default page and limit when query is empty", () => {
    expect(parsePaginationQuery({})).toEqual({ page: 1, limit: 50 });
  });

  it("clamps page and limit to safe bounds", () => {
    expect(parsePaginationQuery({ page: "0", limit: "999" })).toEqual({ page: 1, limit: 200 });
  });

  it("uses custom options", () => {
    expect(
      parsePaginationQuery(
        { page: "2", limit: "15" },
        { defaultPage: 3, defaultLimit: 25, maxLimit: 30 }
      )
    ).toEqual({ page: 2, limit: 15 });
  });

  it("falls back to defaults when values are not numeric", () => {
    expect(parsePaginationQuery({ page: "abc", limit: "xyz" })).toEqual({ page: 1, limit: 50 });
  });
});

describe("parseSearchPaginationQuery", () => {
  it("returns default page and pageSize when query is empty", () => {
    expect(parseSearchPaginationQuery({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("clamps page and pageSize to safe bounds", () => {
    expect(parseSearchPaginationQuery({ page: "-1", pageSize: "500" })).toEqual({
      page: 1,
      pageSize: 100
    });
  });

  it("uses custom options for search pagination", () => {
    expect(
      parseSearchPaginationQuery(
        { page: "4", pageSize: "30" },
        { defaultPage: 2, defaultPageSize: 10, maxPageSize: 40 }
      )
    ).toEqual({ page: 4, pageSize: 30 });
  });

  it("falls back to defaults when values are not numeric", () => {
    expect(parseSearchPaginationQuery({ page: "abc", pageSize: "xyz" })).toEqual({
      page: 1,
      pageSize: 20
    });
  });
});
