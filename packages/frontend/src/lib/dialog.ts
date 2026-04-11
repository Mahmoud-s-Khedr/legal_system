import { Modal } from "antd";
import type { ButtonProps } from "antd";
import type { ReactNode } from "react";

export interface ConfirmActionOptions {
  title?: ReactNode;
  content: ReactNode;
  okText?: string;
  cancelText?: string;
  okButtonProps?: ButtonProps;
}

export function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
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
  Modal.error({
    title,
    content: message
  });
}
