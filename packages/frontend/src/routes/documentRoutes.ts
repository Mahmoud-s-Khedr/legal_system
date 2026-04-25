import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { PermissionGate } from "../components/PermissionGate";
import { DocumentsPage } from "./app/DocumentsPage";
import { DocumentUploadPage } from "./app/DocumentUploadPage";
import { SearchPage } from "./app/SearchPage";
import { LibraryPage } from "./app/library/LibraryPage";
import { LibraryDocumentPage } from "./app/library/LibraryDocumentPage";
import { LibrarySearchPage } from "./app/library/LibrarySearchPage";
import { LibraryAdminPage } from "./app/library/LibraryAdminPage";
import { LibraryUploadPage } from "./app/library/LibraryUploadPage";

export function createDocumentRoutes(appRoute: AnyRoute) {
  const documentsRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/documents",
    component: DocumentsPage
  });

  const documentUploadRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/documents/new",
    component: DocumentUploadPage
  });

  const searchRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/search",
    validateSearch: (search: Record<string, unknown>) => ({
      q: typeof search.q === "string" ? search.q : ""
    }),
    component: SearchPage
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
    component: () => createElement(PermissionGate, { permission: "library:read", children: createElement(LibraryUploadPage) })
  });

  return {
    documentsRoute,
    documentUploadRoute,
    searchRoute,
    libraryRoute,
    libraryDocumentRoute,
    librarySearchRoute,
    libraryAdminRoute,
    libraryUploadRoute
  };
}
