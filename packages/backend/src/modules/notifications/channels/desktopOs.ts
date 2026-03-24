/**
 * Desktop OS notification channel.
 * In desktop mode the backend is a Tauri sidecar — OS notifications are sent by
 * the Rust side via Tauri's notification plugin. This channel emits a Tauri IPC
 * event that the frontend listens for and forwards to the plugin.
 *
 * In cloud mode this channel is a no-op.
 */

import { AuthMode } from "@elms/shared";
import type { AppEnv } from "../../../config/env.js";

// The event name the desktop shell listens for to forward to the OS notification API
export const DESKTOP_NOTIFY_EVENT = "elms://desktop-notify";

export async function sendDesktopOs(
  env: AppEnv,
  _userId: string,
  title: string,
  body: string
): Promise<void> {
  if (env.AUTH_MODE !== AuthMode.LOCAL) return; // cloud target — no-op

  // In desktop mode the Tauri webview is local; emit via SSE or a side channel
  // if a push mechanism is wired up. For now this logs so the event can be
  // picked up by a future SSE/WebSocket implementation.
  console.info(`[desktop-os channel] ${title}: ${body}`);
}
