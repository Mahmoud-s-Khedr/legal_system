import type { ButtonProps, ModalFuncProps } from "antd";
import type { ReactNode } from "react";

export interface ConfirmActionOptions {
  title?: ReactNode;
  content: ReactNode;
  okText?: string;
  cancelText?: string;
  okButtonProps?: ButtonProps;
}

interface DialogHandlers {
  confirm: (config: ModalFuncProps) => void;
  error: (config: ModalFuncProps) => void;
}

let dialogHandlers: DialogHandlers | null = null;

export function setDialogHandlers(nextHandlers: DialogHandlers | null) {
  dialogHandlers = nextHandlers;
}

function requireDialogHandlers() {
  if (dialogHandlers) {
    return dialogHandlers;
  }

  throw new Error("Dialog handlers are not ready. Ensure AntdProvider wraps the app.");
}

export function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    requireDialogHandlers().confirm({
      title: options.title,
      content: options.content,
      okText: options.okText,
      cancelText: options.cancelText,
      okButtonProps: options.okButtonProps,
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

export function showErrorDialog(message: ReactNode, title?: ReactNode): void {
  requireDialogHandlers().error({
    title,
    content: message
  });
}
