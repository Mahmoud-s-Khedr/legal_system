import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { createElement } from "react";
import { PermissionGate } from "../components/PermissionGate";
import { InvoicesPage } from "./app/InvoicesPage";
import { InvoiceCreatePage } from "./app/InvoiceCreatePage";
import { InvoiceDetailPage } from "./app/InvoiceDetailPage";
import { ExpensesPage } from "./app/ExpensesPage";

export function createBillingRoutes(appRoute: AnyRoute) {
  const invoicesRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/invoices",
    component: () =>
      createElement(
        PermissionGate,
        { permission: "invoices:read", children: createElement(InvoicesPage) }
      )
  });

  const invoiceCreateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/invoices/new",
    component: () =>
      createElement(
        PermissionGate,
        { permission: "invoices:create", children: createElement(InvoiceCreatePage) }
      )
  });

  const invoiceDetailRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/invoices/$invoiceId",
    component: () =>
      createElement(
        PermissionGate,
        { permission: "invoices:read", children: createElement(InvoiceDetailPage) }
      )
  });

  const expensesRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/expenses",
    component: () =>
      createElement(
        PermissionGate,
        { permission: "expenses:read", children: createElement(ExpensesPage) }
      )
  });

  return {
    invoicesRoute,
    invoiceCreateRoute,
    invoiceDetailRoute,
    expensesRoute
  };
}
