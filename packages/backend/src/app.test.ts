import { beforeEach, describe, expect, it, vi } from "vitest";

const fastifyFactory = vi.fn();
const prismaQueryRaw = vi.fn();
const createStorageAdapter = vi.fn(() => ({ kind: "storage" }));
const initializeBackendMonitoring = vi.fn();

const registerCookiePlugin = vi.fn();
const registerCorsPlugin = vi.fn();
const registerRateLimitPlugin = vi.fn();
const registerMultipartPlugin = vi.fn();
const registerErrorHandler = vi.fn();
const registerJwtPlugin = vi.fn();
const registerSessionContext = vi.fn();
const registerInjectTenantHook = vi.fn();
const registerFirmLifecycleWriteGuard = vi.fn();
const registerLicenseAccessGuard = vi.fn();

const registerAuthRoutes = vi.fn();
const registerLicenseRoutes = vi.fn();
const registerFirmRoutes = vi.fn();
const registerRoleRoutes = vi.fn();
const registerUserRoutes = vi.fn();
const registerInvitationRoutes = vi.fn();
const registerClientRoutes = vi.fn();
const registerCaseRoutes = vi.fn();
const registerHearingRoutes = vi.fn();
const registerTaskRoutes = vi.fn();
const registerDashboardRoutes = vi.fn();
const registerDocumentRoutes = vi.fn();
const registerSearchRoutes = vi.fn();
const registerLookupRoutes = vi.fn();
const registerBillingRoutes = vi.fn();
const registerNotificationRoutes = vi.fn();
const registerTemplateRoutes = vi.fn();
const registerReportRoutes = vi.fn();
const registerLibraryRoutes = vi.fn();
const registerResearchRoutes = vi.fn();
const registerImportRoutes = vi.fn();
const registerPortalAuthRoutes = vi.fn();
const registerPortalRoutes = vi.fn();
const registerGoogleCalendarRoutes = vi.fn();
const registerPowersRoutes = vi.fn();

const swaggerPlugin = vi.fn();
const swaggerUiPlugin = vi.fn();

vi.mock("fastify", () => ({ default: fastifyFactory }));
vi.mock("@fastify/swagger", () => ({ default: swaggerPlugin }));
vi.mock("@fastify/swagger-ui", () => ({ default: swaggerUiPlugin }));

vi.mock("./db/prisma.js", () => ({ prisma: { $queryRaw: prismaQueryRaw } }));
vi.mock("./storage/index.js", () => ({ createStorageAdapter }));
vi.mock("./monitoring/sentry.js", () => ({ initializeBackendMonitoring }));

vi.mock("./plugins/cookie.js", () => ({ registerCookiePlugin }));
vi.mock("./plugins/cors.js", () => ({ registerCorsPlugin }));
vi.mock("./plugins/rateLimit.js", () => ({ registerRateLimitPlugin }));
vi.mock("./plugins/multipart.js", () => ({ registerMultipartPlugin }));
vi.mock("./plugins/errorHandler.js", () => ({ registerErrorHandler }));
vi.mock("./plugins/auth.js", () => ({ registerJwtPlugin }));
vi.mock("./plugins/sessionContext.js", () => ({ registerSessionContext }));

vi.mock("./middleware/injectTenant.js", () => ({ registerInjectTenantHook }));
vi.mock("./middleware/firmLifecycleWriteGuard.js", () => ({ registerFirmLifecycleWriteGuard }));
vi.mock("./middleware/licenseAccessGuard.js", () => ({ registerLicenseAccessGuard }));

vi.mock("./modules/auth/auth.routes.js", () => ({ registerAuthRoutes }));
vi.mock("./modules/editions/license.routes.js", () => ({ registerLicenseRoutes }));
vi.mock("./modules/firms/firms.routes.js", () => ({ registerFirmRoutes }));
vi.mock("./modules/roles/roles.routes.js", () => ({ registerRoleRoutes }));
vi.mock("./modules/users/users.routes.js", () => ({ registerUserRoutes }));
vi.mock("./modules/invitations/invitations.routes.js", () => ({ registerInvitationRoutes }));
vi.mock("./modules/clients/clients.routes.js", () => ({ registerClientRoutes }));
vi.mock("./modules/cases/cases.routes.js", () => ({ registerCaseRoutes }));
vi.mock("./modules/hearings/hearings.routes.js", () => ({ registerHearingRoutes }));
vi.mock("./modules/tasks/tasks.routes.js", () => ({ registerTaskRoutes }));
vi.mock("./modules/dashboard/dashboard.routes.js", () => ({ registerDashboardRoutes }));
vi.mock("./modules/documents/documents.routes.js", () => ({ registerDocumentRoutes }));
vi.mock("./modules/documents/search.routes.js", () => ({ registerSearchRoutes }));
vi.mock("./modules/lookups/lookups.routes.js", () => ({ registerLookupRoutes }));
vi.mock("./modules/billing/billing.routes.js", () => ({ registerBillingRoutes }));
vi.mock("./modules/notifications/notifications.routes.js", () => ({ registerNotificationRoutes }));
vi.mock("./modules/templates/templates.routes.js", () => ({ registerTemplateRoutes }));
vi.mock("./modules/reports/reports.routes.js", () => ({ registerReportRoutes }));
vi.mock("./modules/library/library.routes.js", () => ({ registerLibraryRoutes }));
vi.mock("./modules/research/research.routes.js", () => ({ registerResearchRoutes }));
vi.mock("./modules/import/import.routes.js", () => ({ registerImportRoutes }));
vi.mock("./modules/portal/portal-auth.routes.js", () => ({ registerPortalAuthRoutes }));
vi.mock("./modules/portal/portal.routes.js", () => ({ registerPortalRoutes }));
vi.mock("./modules/integrations/google-calendar.routes.js", () => ({ registerGoogleCalendarRoutes }));
vi.mock("./modules/powers/powers.routes.js", () => ({ registerPowersRoutes }));

const { createApp } = await import("./app.js");

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: "production",
    AUTH_MODE: "local",
    STORAGE_DRIVER: "local",
    ELMS_ENABLE_SWAGGER: false,
    ...overrides
  } as never;
}

describe("createApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN;
  });

  it("registers plugins/routes and returns app", async () => {
    const get = vi.fn();
    const register = vi.fn().mockResolvedValue(undefined);
    const app = {
      log: { info: vi.fn() },
      decorate: vi.fn(),
      register,
      get
    };
    fastifyFactory.mockReturnValue(app);
    prismaQueryRaw.mockResolvedValue(undefined);

    const created = await createApp(makeEnv());

    expect(created).toBe(app);
    expect(fastifyFactory).toHaveBeenCalledWith({ logger: true });
    expect(createStorageAdapter).toHaveBeenCalled();
    expect(initializeBackendMonitoring).toHaveBeenCalled();

    expect(registerCookiePlugin).toHaveBeenCalledWith(app);
    expect(registerCorsPlugin).toHaveBeenCalledWith(app, expect.anything());
    expect(registerRateLimitPlugin).toHaveBeenCalledWith(app, expect.anything());
    expect(registerMultipartPlugin).toHaveBeenCalledWith(app, expect.anything());
    expect(registerJwtPlugin).toHaveBeenCalledWith(app, expect.anything());

    expect(registerAuthRoutes).toHaveBeenCalledWith(app, expect.anything());
    expect(registerRoleRoutes).toHaveBeenCalledWith(app);
    expect(registerUserRoutes).toHaveBeenCalledWith(app, expect.anything());
    expect(registerLibraryRoutes).toHaveBeenCalledWith(app, expect.anything());
    expect(registerGoogleCalendarRoutes).toHaveBeenCalledWith(app, expect.anything());
    expect(registerPowersRoutes).toHaveBeenCalledWith(app);

    expect(get).toHaveBeenCalledWith("/api/health", expect.any(Function));
  });

  it("health endpoint returns ok and includes bootstrap token in local mode when db check succeeds", async () => {
    const get = vi.fn();
    const app = {
      log: { info: vi.fn() },
      decorate: vi.fn(),
      register: vi.fn().mockResolvedValue(undefined),
      get
    };
    fastifyFactory.mockReturnValue(app);
    prismaQueryRaw.mockResolvedValue(undefined);
    process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN = "boot-123";

    await createApp(makeEnv({ AUTH_MODE: "local" }));

    const healthHandler = get.mock.calls.find((entry) => entry[0] === "/api/health")?.[1] as
      | ((req: unknown, reply: unknown) => Promise<unknown>)
      | undefined;

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation((payload: unknown) => payload)
    };

    const payload = await healthHandler!({} as never, reply as never);

    expect(prismaQueryRaw).toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        status: "ok",
        desktopBootstrapToken: "boot-123"
      })
    );
  });

  it("health endpoint omits bootstrap token in non-local mode", async () => {
    const get = vi.fn();
    const app = {
      log: { info: vi.fn() },
      decorate: vi.fn(),
      register: vi.fn().mockResolvedValue(undefined),
      get
    };
    fastifyFactory.mockReturnValue(app);
    prismaQueryRaw.mockResolvedValue(undefined);
    process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN = "boot-123";

    await createApp(makeEnv({ AUTH_MODE: "cloud" }));

    const healthHandler = get.mock.calls.find((entry) => entry[0] === "/api/health")?.[1] as
      | ((req: unknown, reply: unknown) => Promise<unknown>)
      | undefined;

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation((payload: unknown) => payload)
    };

    const payload = await healthHandler!({} as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        status: "ok"
      })
    );
    expect(payload).not.toEqual(expect.objectContaining({ desktopBootstrapToken: "boot-123" }));
  });

  it("health endpoint returns degraded error when db check fails", async () => {
    const get = vi.fn();
    const app = {
      log: { info: vi.fn() },
      decorate: vi.fn(),
      register: vi.fn().mockResolvedValue(undefined),
      get
    };
    fastifyFactory.mockReturnValue(app);
    prismaQueryRaw.mockRejectedValue(new Error("db down"));
    delete process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN;

    await createApp(makeEnv());

    const healthHandler = get.mock.calls.find((entry) => entry[0] === "/api/health")?.[1] as
      | ((req: unknown, reply: unknown) => Promise<unknown>)
      | undefined;

    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation((payload: unknown) => payload)
    };

    const payload = await healthHandler!({} as never, reply as never);

    expect(reply.status).toHaveBeenCalledWith(503);
    expect(payload).toEqual(
      expect.objectContaining({ ok: false, status: "error", checks: expect.objectContaining({ db: "error" }) })
    );
  });

  it("registers swagger in production when explicitly enabled", async () => {
    const app = {
      log: { info: vi.fn() },
      decorate: vi.fn(),
      register: vi.fn().mockResolvedValue(undefined),
      get: vi.fn()
    };
    fastifyFactory.mockReturnValue(app);
    prismaQueryRaw.mockResolvedValue(undefined);

    await createApp(makeEnv({ ELMS_ENABLE_SWAGGER: true }));

    expect(app.register).toHaveBeenCalledWith(swaggerPlugin, expect.any(Object));
    expect(app.register).toHaveBeenCalledWith(swaggerUiPlugin, { routePrefix: "/docs" });
  });
});
