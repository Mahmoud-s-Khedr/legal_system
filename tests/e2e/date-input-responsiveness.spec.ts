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

  test("task submit sends selected due date without requiring blur", async ({ page }) => {
    await login(page);

    let postBody: Record<string, unknown> | null = null;

    await page.route("**/api/tasks", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      postBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "task-test-id",
          title: postBody?.title ?? "Task",
          status: "PENDING",
          priority: "MEDIUM",
          caseId: null,
          caseTitle: null,
          description: null,
          assignedToId: null,
          assignedToName: null,
          createdById: null,
          createdByName: null,
          dueAt: postBody?.dueAt ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      });
    });

    await page.goto("/app/tasks/new");
    await page.getByLabel(/title|العنوان|titre/i).fill(`Date Submit ${Date.now()}`);
    await page.getByLabel(/due date|تاريخ الاستحقاق|échéance/i).fill("2026-04-23T00:07");
    await page.getByRole("button", { name: /create task|إنشاء مهمة|créer une tâche/i }).click();

    await expect.poll(() => postBody).not.toBeNull();
    expect(postBody?.dueAt).toBe(new Date("2026-04-23T00:07").toISOString());
  });

  test("hearing submit sends selected session datetime without requiring blur", async ({ page }) => {
    await login(page);

    let postBody: Record<string, unknown> | null = null;

    await page.route("**/api/hearings", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      postBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "hearing-test-id",
          caseId: postBody?.caseId ?? "case-id",
          caseTitle: "Case",
          assignedLawyerId: postBody?.assignedLawyerId ?? null,
          assignedLawyerName: null,
          sessionDatetime: postBody?.sessionDatetime,
          nextSessionAt: postBody?.nextSessionAt ?? null,
          outcome: postBody?.outcome ?? null,
          notes: postBody?.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      });
    });

    await page.goto("/app/hearings/new");

    const caseSelect = page.getByLabel(/case|القضية|dossier/i);
    const caseOptionsCount = await caseSelect.locator("option").count();
    test.skip(caseOptionsCount < 2, "Requires at least one existing case");
    await caseSelect.selectOption({ index: 1 });

    const selectedLocal = "2026-04-30T14:05";
    await page.getByLabel(/session datetime|موعد الجلسة|date et heure/i).fill(selectedLocal);
    await page.getByRole("button", { name: /schedule hearing|جدولة جلسة|planifier une audience/i }).click();

    await expect.poll(() => postBody).not.toBeNull();
    expect(postBody?.sessionDatetime).toBe(new Date(selectedLocal).toISOString());
  });
});
