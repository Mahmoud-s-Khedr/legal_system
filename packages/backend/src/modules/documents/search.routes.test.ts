import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const searchDocuments = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: "auth-guard"
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("./search.service.js", () => ({
  searchDocuments
}));

const { registerSearchRoutes } = await import("./search.routes.js");

describe("registerSearchRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers route with documents:read permission and passes parsed filters", async () => {
    const app = {
      get: vi.fn()
    };

    await registerSearchRoutes(app as never);

    expect(requirePermission).toHaveBeenCalledWith("documents:read");
    expect(app.get).toHaveBeenCalledTimes(1);

    const [path, options, handler] = app.get.mock.calls[0] as [
      string,
      { preHandler: unknown[] },
      (request: unknown) => Promise<unknown>
    ];

    expect(path).toBe("/api/search/documents");
    expect(options.preHandler).toEqual(["auth-guard", "perm:documents:read"]);

    searchDocuments.mockResolvedValueOnce({ items: [], total: 0, query: "alpha" });

    const actor = makeSessionUser({ permissions: ["documents:read"] });
    const result = await handler({
      query: {
        q: "alpha",
        page: "2",
        pageSize: "7",
        caseId: "case-1",
        clientId: "client-1",
        type: "CONTRACT"
      },
      sessionUser: actor
    });

    expect(searchDocuments).toHaveBeenCalledWith(actor, {
      q: "alpha",
      caseId: "case-1",
      clientId: "client-1",
      type: "CONTRACT",
      page: 2,
      pageSize: 7
    });
    expect(result).toEqual({ items: [], total: 0, query: "alpha" });
  });
});
