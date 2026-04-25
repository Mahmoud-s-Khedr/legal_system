import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { PortalLayout } from "./portal/PortalLayout";
import { PortalLoginPage } from "./portal/PortalLoginPage";
import { PortalDashboardPage } from "./portal/PortalDashboardPage";
import { PortalCasePage } from "./portal/PortalCasePage";

export function createPortalRoutes(rootRoute: AnyRoute) {
  const portalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/portal",
    component: PortalLayout
  });

  const portalLoginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/portal/$firmId/login",
    component: PortalLoginPage
  });

  const portalDashboardRoute = createRoute({
    getParentRoute: () => portalRoute,
    path: "/dashboard",
    component: PortalDashboardPage
  });

  const portalCaseRoute = createRoute({
    getParentRoute: () => portalRoute,
    path: "/cases/$caseId",
    component: PortalCasePage
  });

  return {
    portalRoute,
    portalLoginRoute,
    portalDashboardRoute,
    portalCaseRoute
  };
}
