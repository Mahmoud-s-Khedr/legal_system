import { describe, expect, it } from "vitest";
import { buildAppBreadcrumbItems, resolveBreadcrumbLabelKey } from "./breadcrumbs";

describe("breadcrumb metadata resolver", () => {
  it("resolves static app routes", () => {
    expect(resolveBreadcrumbLabelKey("/app/dashboard")).toBe("nav.dashboard");
    expect(resolveBreadcrumbLabelKey("/app/reports")).toBe("nav.reports");
    expect(resolveBreadcrumbLabelKey("/app/integrations/ppo")).toBe("nav.ppoPortal");
  });

  it("resolves dynamic app routes", () => {
    expect(resolveBreadcrumbLabelKey("/app/clients/abc-123")).toBe("nav.clients");
    expect(resolveBreadcrumbLabelKey("/app/invoices/inv_1")).toBe("billing.invoice");
  });

  it("returns null for unknown routes", () => {
    expect(resolveBreadcrumbLabelKey("/app/unknown/path")).toBeNull();
  });

  it("builds clickable ancestors and leaves current item non-clickable", () => {
    const items = buildAppBreadcrumbItems({
      paths: ["/app", "/app/cases", "/app/cases/abc-123"],
      t: (key) => key
    });

    expect(items[0]).toEqual({ label: "nav.home", to: "/app/dashboard" });
    expect(items[1]).toEqual({ label: "nav.cases", to: "/app/cases" });
    expect(items[2]).toEqual({ label: "nav.cases" });
  });
});
