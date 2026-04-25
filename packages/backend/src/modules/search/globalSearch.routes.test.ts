import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const globalSearch = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: "auth-guard"
}));

vi.mock("./globalSearch.service.js", () => ({
  globalSearch
}));

const { registerGlobalSearchRoutes } = await import("./globalSearch.routes.js");

function createReplyRecorder() {
  const recorder = {
    statusCode: 200,
    payload: undefined as unknown,
    status: vi.fn((code: number) => {
      recorder.statusCode = code;
      return {
        send: (payload: unknown) => {
          recorder.payload = payload;
          return payload;
        }
      };
    })
  };
  return recorder;
}

describe("registerGlobalSearchRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers route with auth preHandler", async () => {
    const app = { get: vi.fn() };

    await registerGlobalSearchRoutes(app as never);

    const [path, options] = app.get.mock.calls[0] as [
      string,
      { preHandler: unknown[] },
      (request: unknown, reply: unknown) => Promise<unknown>
    ];

    expect(path).toBe("/api/search/global");
    expect(options.preHandler).toHaveLength(2);
    expect(options.preHandler?.[0]).toBe("auth-guard");
  });

  it("returns 403 when user has no searchable read permissions", async () => {
    const app = { get: vi.fn() };

    await registerGlobalSearchRoutes(app as never);

    const [, , handler] = app.get.mock.calls[0] as [
      string,
      { preHandler: unknown[] },
      (request: unknown, reply: unknown) => Promise<unknown>
    ];

    const reply = createReplyRecorder();
    const actor = makeSessionUser({ permissions: ["billing:read"] });

    await handler({ query: { q: "alpha" }, sessionUser: actor }, reply);

    expect(reply.statusCode).toBe(403);
    expect(globalSearch).not.toHaveBeenCalled();
  });

  it("sanitizes entities and limit before calling globalSearch", async () => {
    const app = { get: vi.fn() };

    await registerGlobalSearchRoutes(app as never);

    const [, , handler] = app.get.mock.calls[0] as [
      string,
      { preHandler: unknown[] },
      (request: unknown, reply: unknown) => Promise<unknown>
    ];

    const actor = makeSessionUser({ permissions: ["documents:read", "library:read"] });
    globalSearch.mockResolvedValueOnce([]);

    await handler(
      {
        query: { q: "alpha", entities: "documents,unknown,library", limit: "abc" },
        sessionUser: actor
      },
      createReplyRecorder()
    );

    expect(globalSearch).toHaveBeenCalledWith(actor, {
      q: "alpha",
      entities: ["documents", "library"],
      limit: 20
    });
  });

  it("falls back to allowed entities when entities query is empty", async () => {
    const app = { get: vi.fn() };

    await registerGlobalSearchRoutes(app as never);

    const [, , handler] = app.get.mock.calls[0] as [
      string,
      { preHandler: unknown[] },
      (request: unknown, reply: unknown) => Promise<unknown>
    ];

    const actor = makeSessionUser({ permissions: ["cases:read"] });
    globalSearch.mockResolvedValueOnce([]);

    await handler(
      {
        query: { q: "alpha", entities: ",,,", limit: "0" },
        sessionUser: actor
      },
      createReplyRecorder()
    );

    expect(globalSearch).toHaveBeenCalledWith(actor, {
      q: "alpha",
      entities: ["cases"],
      limit: 1
    });
  });

  it("handles non-string query shapes without throwing", async () => {
    const app = { get: vi.fn() };

    await registerGlobalSearchRoutes(app as never);

    const [, , handler] = app.get.mock.calls[0] as [
      string,
      { preHandler: unknown[] },
      (request: unknown, reply: unknown) => Promise<unknown>
    ];

    const actor = makeSessionUser({ permissions: ["documents:read"] });
    globalSearch.mockResolvedValueOnce([]);

    await expect(
      handler(
        {
          query: {
            q: ["alpha", "beta"],
            entities: ["documents,library", "cases"],
            limit: ["7", "9"]
          },
          sessionUser: actor
        },
        createReplyRecorder()
      )
    ).resolves.toEqual([]);

    expect(globalSearch).toHaveBeenCalledWith(actor, {
      q: "alpha",
      entities: ["documents"],
      limit: 7
    });
  });
});
