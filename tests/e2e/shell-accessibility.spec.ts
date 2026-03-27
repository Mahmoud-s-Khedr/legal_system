import { expect, test } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;

test.describe("shell accessibility", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  test("mobile drawer closes on Escape and returns focus to menu trigger", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(adminEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(adminPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    const menuButton = page.getByRole("button", { name: /open menu|فتح القائمة|ouvrir/i });
    await menuButton.click();

    await expect(page.locator("#mobile-nav-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-nav-drawer")).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test("notification panel closes on Escape and restores focus to bell trigger", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(adminEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(adminPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    const bellTrigger = page.getByRole("button", { name: /notifications|الإشعارات|notifications/i });
    await bellTrigger.click();

    await expect(page.locator("#notifications-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#notifications-panel")).toBeHidden();
    await expect(bellTrigger).toBeFocused();
  });
});
