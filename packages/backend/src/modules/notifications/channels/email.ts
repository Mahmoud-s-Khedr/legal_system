/**
 * Email notification channel.
 * Uses nodemailer when SMTP_HOST is configured; silently skips otherwise.
 * Install nodemailer: pnpm --filter backend add nodemailer @types/nodemailer
 */

import type { AppEnv } from "../../../config/env.js";

export async function sendEmail(
  env: AppEnv,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!env.SMTP_HOST) return; // channel not configured

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined
    });

    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html
    });
  } catch (err) {
    // Log but do not throw — notification failure should not break the request
    console.error("[email channel] failed to send email:", err);
  }
}
