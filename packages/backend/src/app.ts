import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "./config/env.js";
import { registerCookiePlugin } from "./plugins/cookie.js";
import { registerCorsPlugin } from "./plugins/cors.js";
import { registerRateLimitPlugin } from "./plugins/rateLimit.js";
import { registerMultipartPlugin } from "./plugins/multipart.js";
import { registerErrorHandler } from "./plugins/errorHandler.js";
import { registerJwtPlugin } from "./plugins/auth.js";
import { registerSessionContext } from "./plugins/sessionContext.js";
import { registerInjectTenantHook } from "./middleware/injectTenant.js";
import { registerFirmLifecycleWriteGuard } from "./middleware/firmLifecycleWriteGuard.js";
import { registerLicenseAccessGuard } from "./middleware/licenseAccessGuard.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerFirmRoutes } from "./modules/firms/firms.routes.js";
import { registerRoleRoutes } from "./modules/roles/roles.routes.js";
import { registerUserRoutes } from "./modules/users/users.routes.js";
import { registerInvitationRoutes } from "./modules/invitations/invitations.routes.js";
import { registerClientRoutes } from "./modules/clients/clients.routes.js";
import { registerCaseRoutes } from "./modules/cases/cases.routes.js";
import { registerHearingRoutes } from "./modules/hearings/hearings.routes.js";
import { registerTaskRoutes } from "./modules/tasks/tasks.routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { registerDocumentRoutes } from "./modules/documents/documents.routes.js";
import { registerSearchRoutes } from "./modules/documents/search.routes.js";
import { registerLookupRoutes } from "./modules/lookups/lookups.routes.js";
import { registerBillingRoutes } from "./modules/billing/billing.routes.js";
import { registerNotificationRoutes } from "./modules/notifications/notifications.routes.js";
import { registerTemplateRoutes } from "./modules/templates/templates.routes.js";
import { registerReportRoutes } from "./modules/reports/reports.routes.js";
import { registerLibraryRoutes } from "./modules/library/library.routes.js";
import { registerResearchRoutes } from "./modules/research/research.routes.js";
import { registerImportRoutes } from "./modules/import/import.routes.js";
import { registerPortalAuthRoutes } from "./modules/portal/portal-auth.routes.js";
import { registerPortalRoutes } from "./modules/portal/portal.routes.js";
import { registerGoogleCalendarRoutes } from "./modules/integrations/google-calendar.routes.js";
import { registerPowersRoutes } from "./modules/powers/powers.routes.js";
import { registerLicenseRoutes } from "./modules/editions/license.routes.js";
import { createStorageAdapter } from "./storage/index.js";
import { initializeBackendMonitoring } from "./monitoring/sentry.js";
import { prisma } from "./db/prisma.js";

export async function createApp(env: AppEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });

  app.log.info(
    {
      mode: env.AUTH_MODE,
      storageDriver: env.STORAGE_DRIVER,
      nodeEnv: env.NODE_ENV
    },
    "backend app initialization started"
  );

  app.decorate("appEnv", env);
  app.decorate("storage", createStorageAdapter(env));
  initializeBackendMonitoring(env, app);

  // OpenAPI / Swagger — only exposed in non-production to avoid leaking schema in prod
  if (env.NODE_ENV !== "production") {
    const { default: swagger } = await import("@fastify/swagger");
    const { default: swaggerUi } = await import("@fastify/swagger-ui");
    await app.register(swagger, {
      openapi: {
        info: {
          title: "ELMS API",
          description: "Egyptian Legal Management System — REST API",
          version: "1.0.0"
        },
        components: {
          securitySchemes: {
            cookieAuth: { type: "apiKey", in: "cookie", name: "accessToken" }
          }
        }
      }
    });
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  await registerCookiePlugin(app);
  await registerCorsPlugin(app, env);
  await registerRateLimitPlugin(app, env);
  await registerMultipartPlugin(app, env);
  await registerJwtPlugin(app, env);
  registerSessionContext(app, env);
  registerLicenseAccessGuard(app);
  registerFirmLifecycleWriteGuard(app);
  registerErrorHandler(app);
  registerInjectTenantHook(app);
  app.log.info("core plugins and middleware registered");

  app.get("/api/health", async (_req, reply) => {
    const desktopBootstrapToken = process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN?.trim();
    const checks: Record<string, unknown> = {};
    let overallStatus: "ok" | "degraded" | "error" = "ok";

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = "ok";
    } catch {
      checks.db = "error";
      overallStatus = "error";
    }

    checks.deployment = "local-only";

    const statusCode = overallStatus === "error" ? 503 : 200;

    return reply.status(statusCode).send({
      ok: overallStatus !== "error",
      status: overallStatus,
      mode: "local",
      timestamp: new Date().toISOString(),
      checks,
      ...(desktopBootstrapToken ? { desktopBootstrapToken } : {})
    });
  });

  await registerAuthRoutes(app, env);
  await registerLicenseRoutes(app);
  await registerFirmRoutes(app);
  await registerRoleRoutes(app);
  await registerUserRoutes(app, env);
  await registerInvitationRoutes(app, env);
  await registerClientRoutes(app);
  await registerCaseRoutes(app);
  await registerHearingRoutes(app, env);
  await registerTaskRoutes(app);
  await registerDashboardRoutes(app);
  await registerDocumentRoutes(app, env);
  await registerSearchRoutes(app);
  await registerLookupRoutes(app);
  await registerBillingRoutes(app);
  await registerNotificationRoutes(app);
  await registerTemplateRoutes(app);
  await registerReportRoutes(app);
  await registerLibraryRoutes(app, env);
  await registerResearchRoutes(app);
  await registerImportRoutes(app);
  await registerPortalAuthRoutes(app, env);
  await registerPortalRoutes(app);
  await registerGoogleCalendarRoutes(app, env);
  await registerPowersRoutes(app);

  app.log.info("backend routes registered");

  return app;
}
