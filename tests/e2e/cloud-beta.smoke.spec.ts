import { expect, test } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;

test.describe("cloud beta daily flow", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  test("creates a client, case, hearing, and task then loads the dashboard", async ({ page }) => {
    const suffix = Date.now().toString();
    const clientName = `Beta Client ${suffix}`;
    const caseTitle = `Beta Case ${suffix}`;
    const taskTitle = `Beta Task ${suffix}`;

    await page.goto("/login");
    await page.getByLabel(/email|البريد الإلكتروني|e-mail/i).fill(adminEmail!);
    await page.getByLabel(/password|كلمة المرور|mot de passe/i).fill(adminPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول|connexion/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard$/);

    await page.goto("/app/clients");
    await page.getByLabel(/name|الاسم|nom/i).first().fill(clientName);
    await page.getByLabel(/arabic name|الاسم بالعربية|nom arabe/i).fill(`عميل ${suffix}`);
    await page.getByRole("button", { name: /create client|إضافة عميل|créer un client/i }).click();
    await expect(page.getByText(clientName)).toBeVisible();

    await page.goto("/app/cases");
    await page.getByLabel(/title|العنوان|titre/i).fill(caseTitle);
    await page.getByLabel(/case number|رقم القضية|numéro du dossier/i).fill(`CASE-${suffix}`);
    await page.getByRole("button", { name: /create case|إنشاء قضية|créer un dossier/i }).click();
    await expect(page.getByText(caseTitle)).toBeVisible();

    await page.goto("/app/hearings");
    await page.getByRole("button", { name: /new hearing|جلسة جديدة|nouvelle audience/i }).click();
    await page.getByLabel(/case|القضية|dossier/i).selectOption({ label: caseTitle });
    await page
      .getByLabel(/session datetime|موعد الجلسة|date et heure de l'audience/i)
      .fill("2026-03-25T09:00");
    await page.getByRole("button", { name: /schedule hearing|جدولة جلسة|planifier une audience/i }).click();
    await expect(page.getByText(caseTitle).first()).toBeVisible();

    await page.goto("/app/tasks");
    await page.getByLabel(/title|العنوان|titre/i).fill(taskTitle);
    await page.getByLabel(/case|القضية|dossier/i).selectOption({ label: caseTitle });
    await page.getByRole("button", { name: /create task|إنشاء مهمة|créer une tâche/i }).click();
    await expect(page.getByText(taskTitle).first()).toBeVisible();

    await page.goto("/app/dashboard");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /daily operating dashboard|لوحة العمل اليومية|tableau de bord quotidien/i
      })
    ).toBeVisible();
  });
});
