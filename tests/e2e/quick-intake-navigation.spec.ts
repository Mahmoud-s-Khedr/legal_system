import { expect, test } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;

async function loginAsAdmin(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
  await page.goto("/login");
  await page.getByLabel(/email|البريد الإلكتروني|e-mail/i).fill(adminEmail!);
  await page.getByLabel(/password|كلمة المرور|mot de passe/i).fill(adminPassword!);
  await page.getByRole("button", { name: /login|تسجيل الدخول|connexion/i }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

test.describe("quick intake navigation guard", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  test("allows sidebar navigation with untouched quick intake", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/cases/quick-new");
    await expect(page).toHaveURL(/\/app\/cases\/quick-new$/);

    let dialogs = 0;
    page.on("dialog", async (dialog) => {
      dialogs += 1;
      await dialog.dismiss();
    });

    await page.getByRole("link", { name: /dashboard|لوحة التحكم|tableau de bord/i }).first().click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    expect(dialogs).toBe(0);
  });

  test("prompts on edited quick intake and leaves when confirmed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/cases/quick-new");
    await expect(page).toHaveURL(/\/app\/cases\/quick-new$/);

    await page.getByLabel(/title|العنوان|titre/i).first().fill("Edited case title");

    page.once("dialog", async (dialog) => {
      expect(dialog.message().length).toBeGreaterThan(0);
      await dialog.accept();
    });

    await page.getByRole("link", { name: /dashboard|لوحة التحكم|tableau de bord/i }).first().click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
  });

  test("stays on page when leave prompt is canceled", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/app/cases/quick-new");
    await expect(page).toHaveURL(/\/app\/cases\/quick-new$/);

    await page.getByLabel(/title|العنوان|titre/i).first().fill("Edited case title");

    page.once("dialog", async (dialog) => {
      expect(dialog.message().length).toBeGreaterThan(0);
      await dialog.dismiss();
    });

    await page.getByRole("link", { name: /dashboard|لوحة التحكم|tableau de bord/i }).first().click();
    await expect(page).toHaveURL(/\/app\/cases\/quick-new$/);
  });
});
