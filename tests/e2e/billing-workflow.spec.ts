import { expect, test } from "@playwright/test";

const adminEmail = process.env.BETA_ADMIN_EMAIL;
const adminPassword = process.env.BETA_ADMIN_PASSWORD;

test.describe("billing workflow", () => {
  test.skip(!adminEmail || !adminPassword, "Set BETA_ADMIN_EMAIL and BETA_ADMIN_PASSWORD");

  test("creates client → case → invoice → adds payment → verifies PAID status", async ({ page }) => {
    const suffix = Date.now().toString();
    const clientName = `Billing Client ${suffix}`;
    const caseTitle = `Billing Case ${suffix}`;

    // Login
    await page.goto("/login");
    await page.getByLabel(/email|البريد الإلكتروني/i).fill(adminEmail!);
    await page.getByLabel(/password|كلمة المرور/i).fill(adminPassword!);
    await page.getByRole("button", { name: /login|تسجيل الدخول/i }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    // Create client
    await page.goto("/app/clients/new");
    await page.getByLabel(/name|الاسم/i).first().fill(clientName);
    await page.getByRole("button", { name: /create|إضافة/i }).click();
    await expect(page.getByText(clientName)).toBeVisible();

    // Create case linked to client
    await page.goto("/app/cases/new");
    await page.getByLabel(/title|العنوان/i).fill(caseTitle);
    await page.getByLabel(/case number|رقم القضية/i).fill(`BILL-${suffix}`);
    await page.getByLabel(/client|العميل/i).selectOption({ label: clientName });
    await page.getByRole("button", { name: /create case|إنشاء قضية/i }).click();
    await expect(page.getByText(caseTitle)).toBeVisible();

    // Create invoice
    await page.goto("/app/invoices/new");
    await page.getByLabel(/case|القضية/i).selectOption({ label: caseTitle });
    await page.getByRole("button", { name: /add item|إضافة بند/i }).click();
    await page.getByLabel(/description|الوصف/i).first().fill("Legal consultation fees");
    await page.getByLabel(/unit price|سعر الوحدة/i).first().fill("1000");
    await page.getByRole("button", { name: /create invoice|إنشاء فاتورة/i }).click();

    // Verify invoice created in DRAFT status
    await expect(page.getByText(/DRAFT|مسودة/i)).toBeVisible();

    // Issue the invoice
    await page.getByRole("button", { name: /issue|إصدار/i }).click();
    await expect(page.getByText(/ISSUED|صادرة/i)).toBeVisible();

    // Add full payment
    await page.getByRole("button", { name: /add payment|إضافة دفعة/i }).click();
    await page.getByLabel(/amount|المبلغ/i).fill("1000");
    await page.getByLabel(/method|طريقة الدفع/i).selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: /confirm|تأكيد/i }).click();

    // Verify PAID status
    await expect(page.getByText(/PAID|مدفوعة/i)).toBeVisible();
  });
});
