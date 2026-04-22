import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const listLookupOptions = vi.fn();
const createLookupOption = vi.fn();
const updateLookupOption = vi.fn();
const deleteLookupOption = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({ requireAuth: "auth-guard" }));
vi.mock("../../middleware/requirePermission.js", () => ({ requirePermission }));
vi.mock("../../utils/auditContext.js", () => ({ getAuditContext }));
vi.mock("./lookups.service.js", () => ({
  createLookupOption,
  deleteLookupOption,
  listLookupOptions,
  updateLookupOption
}));

const { registerLookupRoutes } = await import("./lookups.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
}

describe("registerLookupRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("lists lookup options for valid entity", async () => {
    const app = createApp();
    listLookupOptions.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 0 });

    await registerLookupRoutes(app as never);

    const listCall = app.get.mock.calls.find((entry) => entry[0] === "/api/lookups/:entity") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(listCall?.[1].preHandler).toEqual(["auth-guard"]);
    const result = await listCall![2]({ params: { entity: "CaseType" }, sessionUser: { id: "u1" } } as never);

    expect(listLookupOptions).toHaveBeenCalledWith({ id: "u1" }, "CaseType");
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 0 });
  });

  it("rejects unknown lookup entity", async () => {
    const app = createApp();
    await registerLookupRoutes(app as never);

    const handler = findHandler(app.get.mock.calls, "/api/lookups/:entity");
    await expect(
      handler!({ params: { entity: "UnknownEntity" }, sessionUser: { id: "u1" } } as never)
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates, updates and deletes lookup options", async () => {
    const app = createApp();
    createLookupOption.mockResolvedValueOnce({ id: "opt-1" });
    updateLookupOption.mockResolvedValueOnce({ id: "opt-1", labelEn: "Updated" });
    deleteLookupOption.mockResolvedValueOnce({ success: true });

    await registerLookupRoutes(app as never);

    const createHandler = findHandler(app.post.mock.calls, "/api/lookups/:entity");
    const created = await createHandler!(
      {
        params: { entity: "CaseType" },
        body: { key: "NEW_KEY", labelAr: "أ", labelEn: "A", labelFr: "A" },
        sessionUser: { id: "u1" }
      } as never
    );
    expect(created).toEqual({ id: "opt-1" });
    expect(createLookupOption).toHaveBeenCalled();

    const updateHandler = findHandler(app.put.mock.calls, "/api/lookups/:entity/:id");
    const updated = await updateHandler!(
      {
        params: { entity: "CaseType", id: "opt-1" },
        body: { labelAr: "ب", labelEn: "Updated", labelFr: "M", isActive: true, sortOrder: 1 },
        sessionUser: { id: "u1" }
      } as never
    );
    expect(updated).toEqual({ id: "opt-1", labelEn: "Updated" });

    const deleteHandler = findHandler(app.delete.mock.calls, "/api/lookups/:entity/:id");
    const removed = await deleteHandler!(
      { params: { entity: "CaseType", id: "opt-1" }, sessionUser: { id: "u1" } } as never
    );

    expect(deleteLookupOption).toHaveBeenCalledWith(
      { id: "u1" },
      "CaseType",
      "opt-1",
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(removed).toEqual({ success: true });
  });
});
