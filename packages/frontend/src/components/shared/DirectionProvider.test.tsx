import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseTranslation = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => mockUseTranslation()
}));

const { DirectionProvider } = await import("./DirectionProvider");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(children: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<DirectionProvider>{children}</DirectionProvider>);
  });

  return container;
}

beforeEach(() => {
  mockUseTranslation.mockReturnValue({
    i18n: { resolvedLanguage: "ar-EG", language: "ar-EG" }
  });
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.documentElement.setAttribute("data-dir", "ltr");
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
});

describe("DirectionProvider", () => {
  it("treats Arabic language variants as rtl", () => {
    render(<div>content</div>);

    expect(document.documentElement.lang).toBe("ar-EG");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.getAttribute("data-dir")).toBe("rtl");
  });

  it("treats non-Arabic languages as ltr", () => {
    mockUseTranslation.mockReturnValue({
      i18n: { resolvedLanguage: "en-US", language: "en-US" }
    });

    render(<div>content</div>);

    expect(document.documentElement.lang).toBe("en-US");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.getAttribute("data-dir")).toBe("ltr");
  });
});
