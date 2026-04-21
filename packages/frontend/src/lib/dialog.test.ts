import { afterEach, describe, expect, it, vi } from "vitest";

const confirmMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());

afterEach(async () => {
  const { setDialogHandlers } = await import("./dialog");
  setDialogHandlers(null);
});

describe("dialog helpers", () => {
  it("confirmAction resolves true on modal ok", async () => {
    const { confirmAction, setDialogHandlers } = await import("./dialog");
    setDialogHandlers({ confirm: confirmMock, error: errorMock });
    confirmMock.mockImplementationOnce((options: { onOk?: () => void }) => {
      options.onOk?.();
    });

    await expect(confirmAction({ content: "Delete item?" })).resolves.toBe(true);
  });

  it("confirmAction resolves false on modal cancel", async () => {
    const { confirmAction, setDialogHandlers } = await import("./dialog");
    setDialogHandlers({ confirm: confirmMock, error: errorMock });
    confirmMock.mockImplementationOnce((options: { onCancel?: () => void }) => {
      options.onCancel?.();
    });

    await expect(confirmAction({ content: "Delete item?" })).resolves.toBe(false);
  });

  it("showErrorDialog forwards message to Modal.error", async () => {
    const { showErrorDialog, setDialogHandlers } = await import("./dialog");
    setDialogHandlers({ confirm: confirmMock, error: errorMock });

    showErrorDialog("Something failed");

    expect(errorMock).toHaveBeenCalledWith({
      title: undefined,
      content: "Something failed"
    });
  });

  it("confirmAction forwards custom button labels", async () => {
    const { confirmAction, setDialogHandlers } = await import("./dialog");
    setDialogHandlers({ confirm: confirmMock, error: errorMock });
    confirmMock.mockImplementationOnce((options: { onCancel?: () => void }) => {
      options.onCancel?.();
    });

    await confirmAction({
      content: "Leave this page?",
      okText: "Leave",
      cancelText: "Stay"
    });

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      okText: "Leave",
      cancelText: "Stay"
    }));
  });
});
