import { describe, expect, it, vi, beforeEach } from "vitest";

const verify = vi.fn();
const findUnique = vi.fn();

vi.mock("./operatorAuth.js", () => ({
  getOperatorJwt: () => ({ verify })
}));
vi.mock("../db/prisma.js", () => ({
  prisma: { operatorUser: { findUnique } }
}));

const { registerOperatorSessionContext } = await import("./operatorSessionContext.js");

function createApp() {
  const hooks: Array<(request: unknown) => Promise<void>> = [];
  return {
    decorateRequest: vi.fn(),
    addHook: vi.fn((_name: string, handler: (request: unknown) => Promise<void>) => {
      hooks.push(handler);
    }),
    runPreHandler: async (request: unknown) => {
      for (const hook of hooks) {
        await hook(request);
      }
    }
  };
}

describe("registerOperatorSessionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves operatorUser null when no operator cookie is present", async () => {
    const app = createApp();
    registerOperatorSessionContext(app as never);

    const request: { cookies: Record<string, string>; operatorUser: unknown } = {
      cookies: {},
      operatorUser: undefined
    };
    await app.runPreHandler(request);

    expect(request.operatorUser).toBeNull();
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a token that fails operator-audience verification (e.g. a tenant-issued token)", async () => {
    verify.mockRejectedValueOnce(new Error("audience mismatch"));
    const app = createApp();
    registerOperatorSessionContext(app as never);

    const request = {
      cookies: { elms_operator_access_token: "tenant-issued-token" },
      operatorUser: undefined as unknown
    };
    await app.runPreHandler(request);

    expect(request.operatorUser).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("resolves the operator when the token verifies and the operator is active", async () => {
    verify.mockResolvedValueOnce({ sub: "op-1", email: "a@b.com", displayName: "Op" });
    findUnique.mockResolvedValueOnce({
      id: "op-1",
      email: "a@b.com",
      displayName: "Op",
      status: "ACTIVE"
    });
    const app = createApp();
    registerOperatorSessionContext(app as never);

    const request = {
      cookies: { elms_operator_access_token: "valid-operator-token" },
      operatorUser: undefined as unknown
    };
    await app.runPreHandler(request);

    expect(request.operatorUser).toEqual({
      id: "op-1",
      email: "a@b.com",
      displayName: "Op",
      status: "ACTIVE"
    });
  });

  it("rejects a suspended operator even with a valid token", async () => {
    verify.mockResolvedValueOnce({ sub: "op-1", email: "a@b.com", displayName: "Op" });
    findUnique.mockResolvedValueOnce({
      id: "op-1",
      email: "a@b.com",
      displayName: "Op",
      status: "SUSPENDED"
    });
    const app = createApp();
    registerOperatorSessionContext(app as never);

    const request = {
      cookies: { elms_operator_access_token: "valid-operator-token" },
      operatorUser: undefined as unknown
    };
    await app.runPreHandler(request);

    expect(request.operatorUser).toBeNull();
  });
});
