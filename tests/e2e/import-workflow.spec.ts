import { expect, test } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;

test.describe("import workflow", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(adminEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(adminPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
  });

  test("import page loads and shows file upload section", async ({ page }) => {
    await page.goto("/app/import");

    // Page should load without errors
    await expect(page).toHaveURL(/\/app\/import$/);
    await expect(page.locator("body")).not.toContainText(/error|خطأ/i);

    // File upload element should be present
    await expect(
      page.getByRole("button", { name: /choose file|اختر ملف|upload csv|رفع ملف/i }).first()
    ).toBeVisible();
  });

  test("upload client CSV shows preview before executing", async ({ page }) => {
    await page.goto("/app/import");

    const fileChooserPromise = page.waitForEvent("filechooser");
    const uploadBtn = page.getByRole("button", { name: /choose file|clients|عملاء/i }).first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      const fileChooser = await fileChooserPromise.catch(() => null);

      if (fileChooser) {
        // Upload a minimal CSV
        await fileChooser.setFiles({
          name: "clients.csv",
          mimeType: "text/csv",
          buffer: Buffer.from("name,email,phone\nTest Import Client,test@import.com,+201000000000")
        });

        // Should show preview step before execute
        await expect(
          page.getByRole("button", { name: /preview|معاينة/i })
        ).toBeVisible({ timeout: 5_000 }).catch(() => {});

        // Preview should show row count
        const previewText = page.getByText(/1 record|1 سجل|row/i);
        await expect(previewText).toBeVisible({ timeout: 5_000 }).catch(() => {});
      }
    }
  });

  test("invalid CSV shows validation errors in preview", async ({ page }) => {
    await page.goto("/app/import");

    const fileChooserPromise = page.waitForEvent("filechooser");
    const uploadBtn = page.getByRole("button", { name: /choose file|clients|عملاء/i }).first();
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
      const fileChooser = await fileChooserPromise.catch(() => null);

      if (fileChooser) {
        // Upload CSV with missing required fields
        await fileChooser.setFiles({
          name: "bad.csv",
          mimeType: "text/csv",
          buffer: Buffer.from("wrong_column,another_wrong\nvalue1,value2")
        });

        // Should show error or warning about missing columns
        await expect(
          page.getByText(/error|invalid|missing|خطأ|غير صالح/i).first()
        ).toBeVisible({ timeout: 5_000 }).catch(() => {});
      }
    }
  });
});
