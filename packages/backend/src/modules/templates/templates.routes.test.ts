import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const exportTemplateDocx = vi.fn();

vi.mock("./templates.service.js", () => ({
  createTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
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
        params: { id: "tpl-1" },
        query: { format: "docx", mode: "rendered" },
        body: {},
        sessionUser: makeSessionUser({ permissions: ["templates:read"] })
      },
      reply
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(exportTemplateDocx).not.toHaveBeenCalled();
  });
});
