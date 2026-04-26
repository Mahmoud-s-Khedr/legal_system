import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { apiFormFetch } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  apiFormFetch: vi.fn()
}));

vi.mock("../../lib/lookups", () => ({
  useLookupOptions: () => ({
    data: {
      items: [{ key: "GENERAL" }]
    }
  })
}));

vi.mock("../../lib/uploadQueue", () => ({
  runUploadQueue: vi.fn(async ({ items, upload, onStatusChange }) => {
    for (let index = 0; index < items.length; index += 1) {
      onStatusChange(index, "uploading");
      await upload(items[index]);
      onStatusChange(index, "success");
    }

    return {
      totalCount: items.length,
      successCount: items.length,
      failedCount: 0,
      successes: [],
      failures: []
    };
  })
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderForm() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient}>
        <DocumentUploadForm taskId="task-123" invalidateKey={["task-documents", "task-123"]} />
      </QueryClientProvider>
    );
  });

  return container;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
  vi.restoreAllMocks();
});

describe("DocumentUploadForm", () => {
  it("sends taskId in multipart payload when uploading", async () => {
    vi.mocked(apiFormFetch).mockResolvedValue({ id: "doc-1" } as never);

    const view = renderForm();
    const fileInput = view.querySelector("input[type='file']") as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["hello"], "note.pdf", { type: "application/pdf" });

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [file],
        configurable: true
      });
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const submit = view.querySelector("button[type='submit']") as HTMLButtonElement;
    expect(submit).not.toBeNull();

    await act(async () => {
      submit.click();
    });

    await flushAsyncWork();

    expect(apiFormFetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = vi.mocked(apiFormFetch).mock.calls[0] ?? [];
    const formData = requestInit?.body as FormData;

    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("taskId")).toBe("task-123");
  });
});
