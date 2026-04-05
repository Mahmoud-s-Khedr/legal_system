import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email|البريد الإلكتروني|e-mail/i).fill(adminEmail!);
  await page.getByLabel(/password|كلمة المرور|mot de passe/i).fill(adminPassword!);
  await page.getByRole("button", { name: /login|تسجيل الدخول|connexion/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 }
];

test.describe("responsive layout", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  for (const viewport of viewports) {
    test(`core screens have no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await login(page);

      const routes = ["/app/dashboard", "/app/cases", "/app/tasks", "/app/documents", "/app/calendar"];
      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(150);
        const hasOverflow = await page.evaluate(() => {
          const root = document.documentElement;
          return root.scrollWidth > root.clientWidth + 1;
        });
        expect(hasOverflow, `horizontal overflow on ${route}`).toBe(false);
      }
    });
  }

  test("mobile cards are visible on cases list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/app/cases");

    await expect(page.locator("article.rounded-2xl.border").first()).toBeVisible();
    await expect(page.locator("table").first()).toBeHidden();
  });
});
