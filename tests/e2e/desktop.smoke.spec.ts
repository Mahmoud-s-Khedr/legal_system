import { expect, test } from "@playwright/test";

const dummyLanBackendUrl = process.env.DUMMY_LAN_BACKEND_URL;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL;

test.describe("dummy desktop connectivity", () => {
  test.skip(
    !dummyLanBackendUrl || !baseUrl,
    "Set PLAYWRIGHT_BASE_URL to the running Dummy desktop host and DUMMY_LAN_BACKEND_URL to the reachable LAN backend."
  );

  test("connects to a reachable LAN backend from the backend connection screen", async ({ page }) => {
    await page.goto("/connection");

    const urlInput = page.getByLabel(/backend url|عنوان الخادم|url du backend/i);
    await urlInput.fill(dummyLanBackendUrl!);

    await page.getByRole("button", { name: /save url|حفظ|enregistrer/i }).click();
    await expect(page.getByText(/saved|تم الحفظ|enregistrée/i)).toBeVisible();

    await page.getByRole("button", { name: /test connection|اختبار الاتصال|tester la connexion/i }).click();
    await expect(
      page.getByText(/reachable|يمكن الوصول|accessible/i)
    ).toBeVisible();
  });
});
