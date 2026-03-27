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

test.describe("date input responsiveness", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  test("task due-date selection stays responsive", async ({ page }) => {
    await login(page);
    await page.goto("/app/tasks/new");

    await page.getByLabel(/title|العنوان|titre/i).fill(`Date Perf ${Date.now()}`);
    const dueInput = page.getByLabel(/due date|تاريخ الاستحقاق|échéance/i);
    await dueInput.fill("2026-03-18T08:09");

    await page.getByLabel(/description|الوصف|description/i).fill("still responsive after datetime change");
    await page.getByLabel(/priority|الأولوية|priorité/i).selectOption({ index: 1 });

    await expect(page.getByLabel(/description|الوصف|description/i)).toHaveValue(/still responsive/);
  });

  test("hearing datetime selection stays responsive", async ({ page }) => {
    await login(page);
    await page.goto("/app/hearings/new");

    const sessionInput = page.getByLabel(/session datetime|موعد الجلسة|date et heure/i);
    await sessionInput.fill("2026-03-18T09:30");

    await page.getByLabel(/notes|ملاحظات|notes/i).fill("no freeze after date change");
    await page.getByLabel(/outcome|النتيجة|résultat/i).selectOption({ index: 0 });

    await expect(page.getByLabel(/notes|ملاحظات|notes/i)).toHaveValue(/no freeze/);
  });
});
