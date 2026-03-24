import { test } from "@playwright/test";

test.skip("desktop smoke", async () => {
  test.info().annotations.push({
    type: "todo",
    description: "Replace this placeholder with real Tauri automation once the desktop harness is available."
  });
});
