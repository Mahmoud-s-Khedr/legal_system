import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { PermissionGate } from "../components/PermissionGate";
import { DocumentsPage } from "./app/DocumentsPage";
import { DocumentUploadPage } from "./app/DocumentUploadPage";
import { DocumentDetailPage } from "./app/DocumentDetailPage";
import { SearchPage } from "./app/SearchPage";
import { LibraryPage } from "./app/library/LibraryPage";
import { LibraryDocumentPage } from "./app/library/LibraryDocumentPage";
import { LibrarySearchPage } from "./app/library/LibrarySearchPage";
import { LibraryAdminPage } from "./app/library/LibraryAdminPage";
import { LibraryUploadPage } from "./app/library/LibraryUploadPage";

const SEARCH_READ_PERMISSIONS = [
  "cases:read",
  "clients:read",
  "tasks:read",
  "documents:read",
  "library:read"
];

export function createDocumentRoutes(appRoute: AnyRoute) {
  const documentsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/documents",
    component: () => createElement(PermissionGate, { permission: "documents:read", children: createElement(DocumentsPage) })
  });

  const documentDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/documents/$documentId",
    component: () =>
      createElement(PermissionGate, {
        permission: "documents:read",
        children: createElement(DocumentDetailPage)
      })
  });

  const documentUploadRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/documents/new",
    component: () => createElement(PermissionGate, { permission: "documents:create", children: createElement(DocumentUploadPage) })
  });

  const searchRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/search",
    validateSearch: (search: Record<string, unknown>) => ({
      q: typeof search.q === "string" ? search.q : "",
      page: coercePositiveInt(search.page, 1),
      pageSize: coercePositiveInt(search.pageSize, 20, 100)
    }),
    component: () => createElement(PermissionGate, { permissions: SEARCH_READ_PERMISSIONS, children: createElement(SearchPage) })
  });

  const libraryRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/library",
    component: () => createElement(PermissionGate, { permission: "library:read", children: createElement(LibraryPage) })
  });

  const libraryDocumentRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/library/documents/$documentId",
    component: () => createElement(PermissionGate, { permission: "library:read", children: createElement(LibraryDocumentPage) })
  });

  const librarySearchRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/library/search",
    component: () => createElement(PermissionGate, { permission: "library:read", children: createElement(LibrarySearchPage) })
  });

  const libraryAdminRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/library/admin",
    component: () => createElement(PermissionGate, { permission: "library:manage", children: createElement(LibraryAdminPage) })
  });

  const libraryUploadRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/library/upload",
    component: () => createElement(PermissionGate, { permission: "library:manage", children: createElement(LibraryUploadPage) })
  });

  return {
    documentsRoute,
    documentDetailRoute,
    documentUploadRoute,
    searchRoute,
    libraryRoute,
    libraryDocumentRoute,
    librarySearchRoute,
    libraryAdminRoute,
    libraryUploadRoute
  };
}

function coercePositiveInt(
  value: unknown,
  fallback: number,
  max = Number.POSITIVE_INFINITY
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}
