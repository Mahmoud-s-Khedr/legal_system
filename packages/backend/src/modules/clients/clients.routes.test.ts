import { beforeEach, describe, expect, it, vi } from "vitest";
import { Language } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

const createClient = vi.fn();
const listClients = vi.fn();

vi.mock("./clients.service.js", () => ({
  createClient,
  listClients,
  getClient: vi.fn(),
  updateClient: vi.fn(),
  removeClient: vi.fn()
}));

const { registerClientRoutes } = await import("./clients.routes.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerClientRoutes", () => {
  it("GET /api/clients forwards one-character query", async () => {
    const get = vi.fn();
    const app = {
      get,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    listClients.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });

    await registerClientRoutes(app as never);

    const getCall = get.mock.calls.find((call) => call[0] === "/api/clients");
    expect(getCall).toBeDefined();
    const handler = getCall?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["clients:read"] });
    await handler!({
      query: { q: "ا", page: "1", limit: "20" },
      sessionUser: actor
    });

    expect(listClients).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ q: "ا" })
    );
  });

  it("POST /api/clients returns top-level ClientDto object", async () => {
    const post = vi.fn();
    const app = {
      get: vi.fn(),
      post,
      put: vi.fn(),
      delete: vi.fn()
    };

    await registerClientRoutes(app as never);

    const postCall = post.mock.calls.find((call) => call[0] === "/api/clients");
    expect(postCall).toBeDefined();

    const handler = postCall?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    createClient.mockResolvedValue({
      client: {
        id: "client-1",
        name: "Ahmed Hassan",
        type: "INDIVIDUAL",
        phone: null,
        email: null,
        governorate: null,
        preferredLanguage: Language.AR,
        nationalId: null,
        commercialRegister: null,
        taxNumber: null,
        contacts: [],
        linkedCaseCount: 0,
        invoiceCount: 0,
        documentCount: 0,
        createdAt: new Date("2026-03-21T00:00:00.000Z").toISOString(),
        updatedAt: new Date("2026-03-21T00:00:00.000Z").toISOString()
      },
      conflictWarnings: [{ name: "Opposing Party", conflictingCaseId: "case-2", conflictingCaseTitle: "Case" }]
    });

    const response = await handler!({
      body: {
        name: "Ahmed Hassan",
        type: "INDIVIDUAL",
        phone: null,
        email: null,
        governorate: null,
        preferredLanguage: Language.AR,
        nationalId: null,
        commercialRegister: null,
        taxNumber: null,
        contacts: []
      },
      sessionUser: makeSessionUser({ permissions: ["clients:create"] }),
      ip: "127.0.0.1",
      headers: { "user-agent": "vitest" }
    });

    expect(response).toMatchObject({ id: "client-1", name: "Ahmed Hassan" });
    expect(response).not.toHaveProperty("client");
    expect(response).not.toHaveProperty("conflictWarnings");
  });
});
