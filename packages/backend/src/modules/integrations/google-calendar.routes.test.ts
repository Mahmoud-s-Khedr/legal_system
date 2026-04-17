import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../config/env.js";

const requireAuth = vi.fn(async () => {});
const requireEditionFeatureHandler = vi.fn(async () => {});
const requireEditionFeature = vi.fn(() => requireEditionFeatureHandler);

const buildAuthUrl = vi.fn((_env: AppEnv, state: string) => `https://accounts.example.test/oauth?state=${encodeURIComponent(state)}`);
const handleOAuthCallback = vi.fn();
const revokeCalendarAccess = vi.fn();
const getConnectionStatus = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth
}));

vi.mock("../../middleware/requireEditionFeature.js", () => ({
  requireEditionFeature
}));

vi.mock("./googleCalendar.service.js", () => ({
  buildAuthUrl,
  handleOAuthCallback,
  revokeCalendarAccess,
  getConnectionStatus
}));

const { registerGoogleCalendarRoutes } = await import("./google-calendar.routes.js");

function makeEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    GOOGLE_OAUTH_CLIENT_ID: "client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "top-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost/callback",
    ...overrides
  } as AppEnv;
}

describe("registerGoogleCalendarRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleOAuthCallback.mockResolvedValue(undefined);
  });

  it("signs auth state and accepts the callback for valid state", async () => {
    const get = vi.fn();
    const del = vi.fn();
    const app = { get, delete: del };
    const env = makeEnv();

    await registerGoogleCalendarRoutes(app as never, env);

    const authCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/auth");
    const authHandler = authCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const authReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await authHandler(
      {
        sessionUser: { id: "user-1", firmId: "firm-1" }
      },
      authReply
    );

    expect(buildAuthUrl).toHaveBeenCalled();

    const redirectUrl = authReply.redirect.mock.calls[0][0] as string;
    const state = new URL(redirectUrl).searchParams.get("state");
    expect(state).toBeTruthy();

    const callbackCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/callback");
    const callbackHandler = callbackCall?.[1] as (request: unknown, reply: unknown) => Promise<unknown>;

    const callbackReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await callbackHandler(
      {
        query: { code: "oauth-code", state }
      },
      callbackReply
    );

    expect(handleOAuthCallback).toHaveBeenCalledWith("oauth-code", "user-1", "firm-1", env);
    expect(callbackReply.redirect).toHaveBeenCalledWith("/app/settings?calendarConnected=1");
  });

  it("rejects tampered state in callback", async () => {
    const get = vi.fn();
    const del = vi.fn();
    const app = { get, delete: del };
    const env = makeEnv();

    await registerGoogleCalendarRoutes(app as never, env);

    const authCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/auth");
    const authHandler = authCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const authReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await authHandler(
      {
        sessionUser: { id: "user-1", firmId: "firm-1" }
      },
      authReply
    );

    const redirectUrl = authReply.redirect.mock.calls[0][0] as string;
    const validState = new URL(redirectUrl).searchParams.get("state") ?? "";
    const tamperedState = `${validState.slice(0, -1)}x`;

    const callbackCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/callback");
    const callbackHandler = callbackCall?.[1] as (request: unknown, reply: unknown) => Promise<unknown>;

    const callbackReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await callbackHandler(
      {
        query: { code: "oauth-code", state: tamperedState }
      },
      callbackReply
    );

    expect(callbackReply.status).toHaveBeenCalledWith(400);
    expect(callbackReply.send).toHaveBeenCalledWith({ error: "Invalid state parameter" });
    expect(handleOAuthCallback).not.toHaveBeenCalled();
  });

  it("rejects expired state in callback", async () => {
    const get = vi.fn();
    const del = vi.fn();
    const app = { get, delete: del };
    const env = makeEnv();

    await registerGoogleCalendarRoutes(app as never, env);

    const expiredPayload = Buffer.from(
      JSON.stringify({
        userId: "user-1",
        firmId: "firm-1",
        exp: Math.floor(Date.now() / 1000) - 60
      })
    ).toString("base64url");
    const signature = createHmac("sha256", env.GOOGLE_OAUTH_CLIENT_SECRET as string)
      .update(expiredPayload)
      .digest("base64url");
    const expiredState = `${expiredPayload}.${signature}`;

    const callbackCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/callback");
    const callbackHandler = callbackCall?.[1] as (request: unknown, reply: unknown) => Promise<unknown>;

    const callbackReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await callbackHandler(
      {
        query: { code: "oauth-code", state: expiredState }
      },
      callbackReply
    );

    expect(callbackReply.status).toHaveBeenCalledWith(400);
    expect(callbackReply.send).toHaveBeenCalledWith({ error: "Invalid state parameter" });
    expect(handleOAuthCallback).not.toHaveBeenCalled();
  });

  it("returns 503 when secret is missing", async () => {
    const get = vi.fn();
    const del = vi.fn();
    const app = { get, delete: del };
    const env = makeEnv({ GOOGLE_OAUTH_CLIENT_SECRET: undefined });

    await registerGoogleCalendarRoutes(app as never, env);

    const authCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/auth");
    const authHandler = authCall?.[2] as (request: unknown, reply: unknown) => Promise<unknown>;

    const authReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await authHandler({ sessionUser: { id: "user-1", firmId: "firm-1" } }, authReply);

    expect(authReply.status).toHaveBeenCalledWith(503);

    const callbackCall = get.mock.calls.find((entry) => entry[0] === "/api/integrations/google-calendar/callback");
    const callbackHandler = callbackCall?.[1] as (request: unknown, reply: unknown) => Promise<unknown>;

    const callbackReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis()
    };

    await callbackHandler({ query: { code: "oauth-code", state: "abc.def" } }, callbackReply);

    expect(callbackReply.status).toHaveBeenCalledWith(503);
    expect(callbackReply.send).toHaveBeenCalledWith({ error: "Google Calendar integration is not configured" });
  });
});
