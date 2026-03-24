import { expect, test } from "@playwright/test";

test("route guard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("cloud auth shell renders login workspace", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel(/email|البريد الإلكتروني|e-mail/i)).toBeVisible();
  await expect(page.getByLabel(/password|كلمة المرور|mot de passe/i)).toBeVisible();
});
