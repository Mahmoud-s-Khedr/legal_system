import type { MouseEvent } from "react";

export async function copyTextToClipboard(value: string): Promise<void> {
  const text = value.trim();
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("[external-links] copy to clipboard failed", error);
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  const nextUrl = url.trim();
  if (!nextUrl) {
    return;
  }

  window.open(nextUrl, "_blank", "noopener,noreferrer");
}

export function handleExternalLinkClick(
  event: MouseEvent<HTMLElement>,
  url: string,
  copyValue?: string
) {
  event.preventDefault();
  if (copyValue) {
    void copyTextToClipboard(copyValue);
  }
  void openExternalUrl(url);
}
