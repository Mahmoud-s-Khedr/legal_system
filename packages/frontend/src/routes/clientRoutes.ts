import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { ClientsPage } from "./app/ClientsPage";
import { ClientCreatePage } from "./app/ClientCreatePage";
import { ClientDetailPage } from "./app/ClientDetailPage";
import { ClientEditPage } from "./app/ClientEditPage";

export function createClientRoutes(appRoute: AnyRoute) {
  const clientsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients",
    component: ClientsPage
  });

  const clientCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients/new",
    component: ClientCreatePage
  });

  const clientDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients/$clientId",
    component: ClientDetailPage
  });

  const clientEditRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients/$clientId/edit",
    component: ClientEditPage
  });

  return {
    clientsRoute,
    clientCreateRoute,
    clientDetailRoute,
    clientEditRoute
  };
}
