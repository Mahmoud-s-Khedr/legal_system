import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const exportTemplateDocx = vi.fn();
const deleteTemplate = vi.fn();

vi.mock("./templates.service.js", () => ({
  createTemplate: vi.fn(),
  deleteTemplate,
  exportTemplateDocx,
  getTemplate: vi.fn(),
  listTemplates: vi.fn(),
  renderTemplate: vi.fn(),
  updateTemplate: vi.fn()
}));

const { registerTemplateRoutes } = await import("./templates.routes.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerTemplateRoutes", () => {
  it("returns success payload when deleting an existing template", async () => {
    deleteTemplate.mockResolvedValueOnce(true);
    const del = vi.fn();
    const app = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: del
    };

    await registerTemplateRoutes(app as never);
    const deleteCall = del.mock.calls.find((call) => call[0] === "/api/templates/:id");
    expect(deleteCall).toBeDefined();

    const handler = deleteCall?.[2] as ((request: unknown, reply: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    await handler!(
      {
        params: { id: "123e4567-e89b-42d3-a456-426614174000" },
        sessionUser: makeSessionUser({ permissions: ["templates:delete"] }),
        ip: "127.0.0.1",
        headers: { "user-agent": "vitest" }
      } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true });
  });

  it("requires caseId for rendered export mode", async () => {
    const post = vi.fn();
    const app = {
      get: vi.fn(),
      post,
      put: vi.fn(),
      delete: vi.fn()
    };

    await registerTemplateRoutes(app as never);

    const exportCall = post.mock.calls.find((call) => call[0] === "/api/templates/:id/export");
    expect(exportCall).toBeDefined();

    const handler = exportCall?.[2] as ((request: unknown, reply: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    };

    await handler!(
        {
        params: { id: "123e4567-e89b-42d3-a456-426614174000" },
        query: { format: "docx", mode: "rendered" },
        body: {},
        sessionUser: makeSessionUser({ permissions: ["templates:read"] })
      },
      reply
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(exportTemplateDocx).not.toHaveBeenCalled();
  });

  it("validates template id as UUID", async () => {
    const get = vi.fn();
    const app = {
      get,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };

    await registerTemplateRoutes(app as never);

    const getCall = get.mock.calls.find((call) => call[0] === "/api/templates/:id");
    expect(getCall).toBeDefined();

    const handler = getCall?.[2] as ((request: unknown, reply: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    await expect(
      handler!(
        {
          params: { id: "invalid-id" },
          sessionUser: makeSessionUser({ permissions: ["templates:read"] })
        },
        { status: vi.fn().mockReturnThis(), send: vi.fn() }
      )
    ).rejects.toBeTruthy();
  });

  it("returns 404 when deleting a missing template", async () => {
    deleteTemplate.mockResolvedValueOnce(false);
    const del = vi.fn();
    const app = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: del
    };

    await registerTemplateRoutes(app as never);
    const deleteCall = del.mock.calls.find((call) => call[0] === "/api/templates/:id");
    expect(deleteCall).toBeDefined();

    const handler = deleteCall?.[2] as ((request: unknown, reply: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    await handler!(
      {
        params: { id: "123e4567-e89b-42d3-a456-426614174000" },
        sessionUser: makeSessionUser({ permissions: ["templates:delete"] }),
        ip: "127.0.0.1",
        headers: { "user-agent": "vitest" }
      } as never,
      reply as never
    );

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: "Template not found or is a system template"
    });
  });
});
