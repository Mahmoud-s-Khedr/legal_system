import { afterEach, describe, expect, it, vi } from "vitest";

describe("developerContact", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads developer contact fields from VITE footer env vars", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_FOOTER_NAME", "Mahmoud Khedr");
    vi.stubEnv("VITE_FOOTER_EMAIL", "mahmoud.s.khedr.2@gmail.com");
    vi.stubEnv("VITE_FOOTER_PHONE", "01016240934");
    vi.stubEnv("VITE_FOOTER_LINKEDIN", "https://www.linkedin.com/in/mahmoud-s-khedr/");

    const { getDeveloperContact } = await import("./developerContact");
    expect(getDeveloperContact()).toEqual({
      name: "Mahmoud Khedr",
      email: "mahmoud.s.khedr.2@gmail.com",
      phone: "01016240934",
      linkedin: "https://www.linkedin.com/in/mahmoud-s-khedr/"
    });
  });

  it("falls back to default developer contact when vars are missing", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_FOOTER_PHONE", "");
    vi.stubEnv("VITE_FOOTER_LINKEDIN", "");
    vi.stubEnv("VITE_FOOTER_NAME", "");
    vi.stubEnv("VITE_FOOTER_EMAIL", "");

    const { getDeveloperContact } = await import("./developerContact");
    expect(getDeveloperContact()).toEqual({
      name: "Mahmoud Khedr",
      email: "mahmoud.s.khedr.2@gmail.com",
      phone: "01016240934",
      linkedin: "https://www.linkedin.com/in/mahmoud-s-khedr/"
    });
  });
});
