import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { LibraryUploadPage } from "./LibraryUploadPage";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, isError: false }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() })
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

describe("LibraryUploadPage", () => {
  it("shows firm-only upload hint", () => {
    const view = render(<LibraryUploadPage />);

    expect(view.textContent).toContain(
      i18n.t("library.uploadFirmOnlyHint", { ns: "app" })
    );
  });

  it("does not show scope selector", () => {
    const view = render(<LibraryUploadPage />);

    expect(view.textContent).not.toContain(i18n.t("library.scope", { ns: "app" }));
  });

  it("uses expanded safe image/scanner accept types", () => {
    const view = render(<LibraryUploadPage />);
    const input = view.querySelector('input[type="file"]');
    expect(input?.getAttribute("accept")).toBe(
      ".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif"
    );
  });
});
