/**
 * SMS notification channel (Twilio).
 * Set SMS_PROVIDER=twilio and provide credentials to enable.
 * Install Twilio SDK: pnpm --filter backend add twilio
 */

import type { AppEnv } from "../../../config/env.js";

export async function sendSms(env: AppEnv, to: string, body: string): Promise<void> {
  if (env.SMS_PROVIDER !== "twilio") return; // channel not configured
  if (!env.SMS_ACCOUNT_SID || !env.SMS_AUTH_TOKEN || !env.SMS_FROM_NUMBER) {
    console.warn("[sms channel] Twilio credentials not configured — skipping SMS");
    return;
  }

  try {
    const twilio = await import("twilio");
    const client = twilio.default(env.SMS_ACCOUNT_SID, env.SMS_AUTH_TOKEN);
    await client.messages.create({ body, from: env.SMS_FROM_NUMBER, to });
  } catch (err) {
    console.error("[sms channel] failed to send SMS:", err);
  }
}
