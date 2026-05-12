import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { PermissionGate } from "../components/PermissionGate";
import { ClientsPage } from "./app/ClientsPage";
import { ClientCreatePage } from "./app/ClientCreatePage";
import { ClientDetailPage } from "./app/ClientDetailPage";
import { ClientEditPage } from "./app/ClientEditPage";

export function createClientRoutes(appRoute: AnyRoute) {
  const clientsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients",
    component: () => createElement(PermissionGate, { permission: "clients:read", children: createElement(ClientsPage) })
  });

  const clientCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients/new",
    component: () => createElement(PermissionGate, { permission: "clients:create", children: createElement(ClientCreatePage) })
  });

  const clientDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients/$clientId",
    component: () => createElement(PermissionGate, { permission: "clients:read", children: createElement(ClientDetailPage) })
  });

  const clientEditRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/clients/$clientId/edit",
    component: () => createElement(PermissionGate, { permission: "clients:update", children: createElement(ClientEditPage) })
  });

  return {
    clientsRoute,
    clientCreateRoute,
    clientDetailRoute,
    clientEditRoute
  };
}
