import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { PermissionGate } from "../components/PermissionGate";
import { UsersPage } from "./app/UsersPage";
import { UserCreatePage } from "./app/UserCreatePage";
import { UserDetailPage } from "./app/UserDetailPage";
import { InvitationsPage } from "./app/InvitationsPage";
import { InvitationCreatePage } from "./app/InvitationCreatePage";

export function createUserRoutes(appRoute: AnyRoute) {
  const usersRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/users",
    component: () => createElement(PermissionGate, { permission: "users:read", children: createElement(UsersPage) })
  });

  const userCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/users/new",
    component: () => createElement(PermissionGate, { permission: "users:create", children: createElement(UserCreatePage) })
  });

  const userDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/users/$userId",
    component: () => createElement(PermissionGate, { permission: "users:read", children: createElement(UserDetailPage) })
  });

  const invitationsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/invitations",
    component: () => createElement(PermissionGate, { permission: "invitations:read", children: createElement(InvitationsPage) })
  });

  const invitationCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/invitations/new",
    component: () => createElement(PermissionGate, { permission: "invitations:create", children: createElement(InvitationCreatePage) })
  });

  return {
    usersRoute,
    userCreateRoute,
    userDetailRoute,
    invitationsRoute,
    invitationCreateRoute
  };
}
