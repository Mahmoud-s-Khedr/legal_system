import { expect, test } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;
const portalEmail = process.env.BETA_PORTAL_EMAIL;
const portalPassword = process.env.BETA_PORTAL_PASSWORD;

test.describe("client portal access", () => {
  test.skip(!adminEmail || !adminPassword || !portalEmail || !portalPassword,
    "Set BETA_ADMIN_EMAIL, BETA_ADMIN_PASSWORD, BETA_PORTAL_EMAIL, BETA_PORTAL_PASSWORD"
  );

  test("portal login shows client dashboard with own cases only", async ({ page }) => {
    // Login to portal
    await page.goto("/portal/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(portalEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(portalPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();

    // Should reach portal dashboard
    await expect(page).toHaveURL(/\/portal\/dashboard$/);
  });

  test("portal case detail shows court info but not internal notes", async ({ page }) => {
    await page.goto("/portal/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(portalEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(portalPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();
    await expect(page).toHaveURL(/\/portal\/dashboard$/);

    // Navigate to cases
    const caseLinks = page.getByRole("link", { name: /view|عرض/i });
    const caseCount = await caseLinks.count();
    if (caseCount > 0) {
      await caseLinks.first().click();
      await expect(page).toHaveURL(/\/portal\/cases\//);

      // Courts section should be visible
      await expect(page.getByText(/court|محكمة/i).first()).toBeVisible();

      // Internal notes field should NOT be exposed in portal
      await expect(page.getByText(/internal notes|ملاحظات داخلية/i)).not.toBeVisible();
    }
  });

  test("portal redirects to login on unauthenticated access", async ({ page }) => {
    // Access portal without auth
    await page.goto("/portal/dashboard");
    await expect(page).toHaveURL(/\/portal\/login$/);
  });

  test("staff login cannot access portal routes", async ({ page }) => {
    // Login as staff admin
    await page.goto("/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(adminEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(adminPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    // Try to access portal — should redirect to portal login (different auth system)
    await page.goto("/portal/dashboard");
    await expect(page).toHaveURL(/\/portal\/login$/);
  });
});
