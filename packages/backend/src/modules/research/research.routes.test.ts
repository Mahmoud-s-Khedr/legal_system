import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const requireEditionFeature = vi.fn((feature: string) => `feature:${feature}`);

const createSession = vi.fn();
const listSessions = vi.fn();
const getSession = vi.fn();
const deleteSession = vi.fn();
const sendMessage = vi.fn();
const checkUsageLimit = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("../../middleware/requireEditionFeature.js", () => ({ requireEditionFeature }));
vi.mock("./research.service.js", () => ({
  createSession,
  listSessions,
  getSession,
  deleteSession,
  sendMessage,
  checkUsageLimit
}));

const { registerResearchRoutes } = await import("./research.routes.js");

function createApp() {
  return { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

async function* tokenStream(tokens: string[]) {
  for (const token of tokens) {
    yield token;
  }
}

describe("registerResearchRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports session list/create/get/delete/use", async () => {
    const app = createApp();
    listSessions.mockResolvedValueOnce([{ id: "s1" }]);
    createSession.mockResolvedValueOnce({ id: "s1" });
    getSession.mockResolvedValueOnce({ id: "s1" });
    deleteSession.mockResolvedValueOnce(true);
    checkUsageLimit.mockResolvedValueOnce({ used: 10, limit: 500 });

    await registerResearchRoutes(app as never);

    expect(await findHandler(app.get.mock.calls, "/api/research/sessions")!({ sessionUser: { id: "u1" } } as never)).toEqual([{ id: "s1" }]);

    const createReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    await findHandler(app.post.mock.calls, "/api/research/sessions")!(
      { sessionUser: { id: "u1" }, body: { caseId: "c1", title: "T" } } as never,
      createReply as never
    );
    expect(createReply.status).toHaveBeenCalledWith(201);

    expect(
      await findHandler(app.get.mock.calls, "/api/research/sessions/:sessionId")!(
        { sessionUser: { id: "u1" }, params: { sessionId: "s1" } } as never,
        { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() } as never
      )
    ).toEqual({ id: "s1" });

    expect(
      await findHandler(app.delete.mock.calls, "/api/research/sessions/:sessionId")!(
        { sessionUser: { id: "u1" }, params: { sessionId: "s1" } } as never,
        { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() } as never
      )
    ).toEqual({ success: true });

    expect(await findHandler(app.get.mock.calls, "/api/research/usage")!({ sessionUser: { firmId: "f1" } } as never)).toEqual({ used: 10, limit: 500 });
  });

  it("returns 404 for missing session get/delete", async () => {
    const app = createApp();
    await registerResearchRoutes(app as never);

    getSession.mockResolvedValueOnce(null);
    deleteSession.mockResolvedValueOnce(false);

    const getReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    await findHandler(app.get.mock.calls, "/api/research/sessions/:sessionId")!(
      { sessionUser: { id: "u1" }, params: { sessionId: "missing" } } as never,
      getReply as never
    );
    expect(getReply.status).toHaveBeenCalledWith(404);

    const delReply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    await findHandler(app.delete.mock.calls, "/api/research/sessions/:sessionId")!(
      { sessionUser: { id: "u1" }, params: { sessionId: "missing" } } as never,
      delReply as never
    );
    expect(delReply.status).toHaveBeenCalledWith(404);
  });

  it("streams tokens and handles validation/error branches", async () => {
    const app = createApp();
    await registerResearchRoutes(app as never);

    const raw = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), raw };

    const handler = findHandler(app.post.mock.calls, "/api/research/sessions/:sessionId/messages");

    await handler!(
      { sessionUser: { id: "u1" }, params: { sessionId: "s1" }, body: { content: "   " } } as never,
      reply as never
    );
    expect(reply.status).toHaveBeenCalledWith(400);

    sendMessage.mockReturnValueOnce(tokenStream(["a", "b"]));
    await handler!(
      { sessionUser: { id: "u1" }, params: { sessionId: "s1" }, body: { content: " hello " } } as never,
      reply as never
    );

    expect(raw.write).toHaveBeenCalledWith(expect.stringContaining("token"));
    expect(raw.write).toHaveBeenCalledWith("data: [DONE]\n\n");
    expect(raw.end).toHaveBeenCalled();

    sendMessage.mockImplementationOnce(() => {
      throw new Error("USAGE_LIMIT_EXCEEDED");
    });

    await handler!(
      { sessionUser: { id: "u1" }, params: { sessionId: "s1" }, body: { content: "x" } } as never,
      reply as never
    );

    expect(raw.write).toHaveBeenCalledWith(expect.stringContaining("USAGE_LIMIT_EXCEEDED"));
    expect(requireEditionFeature).toHaveBeenCalledWith("ai_research");
  });
});
