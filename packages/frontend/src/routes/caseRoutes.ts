import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { CasesPage } from "./app/CasesPage";
import { CaseCreatePage } from "./app/CaseCreatePage";
import { CaseQuickIntakePage } from "./app/CaseQuickIntakePage";
import { CaseDetailPage } from "./app/CaseDetailPage";

export function createCaseRoutes(appRoute: AnyRoute) {
  const casesRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/cases",
    component: CasesPage
  });

  const caseCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/cases/new",
    component: CaseCreatePage
  });

  const caseQuickIntakeRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/cases/quick-new",
    component: CaseQuickIntakePage
  });

  const caseDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/cases/$caseId",
    component: CaseDetailPage
  });

  return {
    casesRoute,
    caseCreateRoute,
    caseQuickIntakeRoute,
    caseDetailRoute
  };
}
