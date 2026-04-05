import { describe, expect, it } from "vitest";
import {
  buildAppShellFooterLinks,
  buildAuthShellFooterLinks,
  buildPortalShellFooterLinks
} from "./shellFooterLinks";

const t = (key: string) => key;

describe("shell footer links", () => {
  it("returns app links that point to valid app routes", () => {
    const links = buildAppShellFooterLinks(t);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.to.startsWith("/app/"))).toBe(true);
  });

  it("returns portal links that point to valid portal/auth routes", () => {
    const links = buildPortalShellFooterLinks(t);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.to.startsWith("/portal/") || link.to === "/login")).toBe(true);
  });

  it("returns auth links for login/setup/connection", () => {
    const links = buildAuthShellFooterLinks(t);
    expect(links.map((link) => link.to)).toEqual(["/login", "/setup", "/connection"]);
  });
});
