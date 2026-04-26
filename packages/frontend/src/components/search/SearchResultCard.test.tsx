import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentType, ExtractionStatus } from "@elms/shared";
import { SearchResultCard } from "./SearchResultCard";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

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

describe("SearchResultCard", () => {
  it("renders headline highlights safely without injecting HTML", () => {
    const view = render(
      <SearchResultCard
        result={{
          id: "doc-1",
          title: "Doc",
          fileName: "doc.pdf",
          mimeType: "application/pdf",
          type: DocumentType.GENERAL,
          extractionStatus: ExtractionStatus.INDEXED,
          caseId: null,
          clientId: null,
          taskId: null,
          headline: "<mark>alpha</mark><img src=x onerror=alert(1)>",
          rank: 1,
          createdAt: new Date().toISOString()
        }}
      />
    );

    const mark = view.querySelector("mark");
    expect(mark?.textContent).toBe("alpha");
    expect(view.querySelector("img")).toBeNull();
    expect(view.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
