import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key
    })
  };
});

const { PermissionChecklist } = await import("./PermissionChecklist");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(selected: string[] = []) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <PermissionChecklist
        selected={selected}
        onChange={() => {}}
      />
    );
  });
}

beforeEach(() => {
  render();
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

describe("PermissionChecklist", () => {
  it("does not render Google Calendar integration permission", () => {
    expect(container?.textContent).not.toContain("google_calendar");
    expect(container?.textContent).not.toContain("integrations:google_calendar:manage");
  });
});

