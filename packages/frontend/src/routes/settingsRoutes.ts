import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { PermissionGate } from "../components/PermissionGate";
import { SettingsPage } from "./app/SettingsPage";
import { LookupSettingsPage } from "./app/LookupSettingsPage";
import { LookupSettingsDetailPage } from "./app/LookupSettingsDetailPage";
import { RoleSettingsPage } from "./app/RoleSettingsPage";
import { RoleCreatePage } from "./app/RoleCreatePage";
import { RoleEditPage } from "./app/RoleEditPage";

export function createSettingsRoutes(appRoute: AnyRoute) {
  const settingsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/settings",
    component: () => createElement(PermissionGate, { permission: "settings:read", children: createElement(SettingsPage) })
  });

  const lookupSettingsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/settings/lookups",
    component: () => createElement(PermissionGate, { permission: "lookups:manage", children: createElement(LookupSettingsPage) })
  });

  const lookupSettingsDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/settings/lookups/$entity",
    component: () => createElement(PermissionGate, { permission: "lookups:manage", children: createElement(LookupSettingsDetailPage) })
  });

  const roleSettingsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/settings/roles",
    component: () => createElement(PermissionGate, { permission: "roles:read", children: createElement(RoleSettingsPage) })
  });

  const roleCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/settings/roles/new",
    component: () => createElement(PermissionGate, { permission: "roles:create", children: createElement(RoleCreatePage) })
  });

  const roleEditRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/settings/roles/$roleId/edit",
    component: () => createElement(PermissionGate, { permission: "roles:update", children: createElement(RoleEditPage) })
  });

  return {
    settingsRoute,
    lookupSettingsRoute,
    lookupSettingsDetailRoute,
    roleSettingsRoute,
    roleCreateRoute,
    roleEditRoute
  };
}
