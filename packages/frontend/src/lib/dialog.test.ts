import { describe, expect, it, vi } from "vitest";

const confirmMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());

vi.mock("antd", () => ({
  Modal: {
    confirm: confirmMock,
    error: errorMock
  }
}));

describe("dialog helpers", () => {
  it("confirmAction resolves true on modal ok", async () => {
    const { confirmAction } = await import("./dialog");
    confirmMock.mockImplementationOnce((options: { onOk?: () => void }) => {
      options.onOk?.();
    });

    await expect(confirmAction({ content: "Delete item?" })).resolves.toBe(true);
  });

  it("confirmAction resolves false on modal cancel", async () => {
    const { confirmAction } = await import("./dialog");
    confirmMock.mockImplementationOnce((options: { onCancel?: () => void }) => {
      options.onCancel?.();
    });

    await expect(confirmAction({ content: "Delete item?" })).resolves.toBe(false);
  });

  it("showErrorDialog forwards message to Modal.error", async () => {
    const { showErrorDialog } = await import("./dialog");

    showErrorDialog("Something failed");

    expect(errorMock).toHaveBeenCalledWith({
      title: undefined,
      content: "Something failed"
    });
  });
});
