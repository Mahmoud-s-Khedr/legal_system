/**
 * Google Calendar integration service.
 *
 * Uses the Google OAuth2 / Calendar REST APIs directly via fetch to avoid
 * adding the `googleapis` package. Requires env vars:
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
 *   GOOGLE_OAUTH_REDIRECT_URI, GOOGLE_OAUTH_ENCRYPTION_KEY
 *
 * Token encryption: AES-256-CBC using GOOGLE_OAUTH_ENCRYPTION_KEY (32-byte hex).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { hasEditionFeature } from "../editions/editionPolicy.js";

// ─── Encryption helpers ───────────────────────────────────────────────────────

function getEncryptionKey(env: AppEnv): Buffer {
  const hex = env.GOOGLE_OAUTH_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error("GOOGLE_OAUTH_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

function encrypt(text: string, env: AppEnv): string {
  const key = getEncryptionKey(env);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(data: string, env: AppEnv): string {
  const key = getEncryptionKey(env);
  const [ivHex, encHex] = data.split(":");
  if (!ivHex || !encHex) throw new Error("Invalid encrypted token format");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return decipher.update(encrypted).toString("utf8") + decipher.final().toString("utf8");
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function buildAuthUrl(env: AppEnv, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

async function exchangeCode(code: string, env: AppEnv): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return res.json() as Promise<TokenResponse>;
}

async function refreshAccessToken(refreshToken: string, env: AppEnv): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return res.json() as Promise<TokenResponse>;
}

async function getValidAccessToken(userId: string, env: AppEnv): Promise<string | null> {
  const stored = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!stored) return null;

  if (new Date() < stored.expiresAt) {
    return decrypt(stored.encryptedAccessToken, env);
  }

  // Refresh
  const refreshToken = decrypt(stored.encryptedRefreshToken, env);
  try {
    const tokens = await refreshAccessToken(refreshToken, env);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.googleCalendarToken.updateMany({
      where: { userId, firmId: stored.firmId },
      data: {
        encryptedAccessToken: encrypt(tokens.access_token, env),
        expiresAt: newExpiry
      }
    });
    return tokens.access_token;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function handleOAuthCallback(
  code: string,
  userId: string,
  firmId: string,
  env: AppEnv
): Promise<void> {
  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { editionKey: true }
  });
  if (!hasEditionFeature(firm.editionKey, "google_calendar_sync")) {
    throw new Error("Google Calendar integration is not available for current edition");
  }

  const tokens = await exchangeCode(code, env);
  if (!tokens.refresh_token) {
    throw new Error("No refresh token returned — revoke access and reconnect to get a refresh token");
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.googleCalendarToken.upsert({
    where: { userId },
    create: {
      userId,
      firmId,
      encryptedAccessToken: encrypt(tokens.access_token, env),
      encryptedRefreshToken: encrypt(tokens.refresh_token, env),
      expiresAt,
      scope: tokens.scope
    },
    update: {
      encryptedAccessToken: encrypt(tokens.access_token, env),
      encryptedRefreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token, env) : undefined,
      expiresAt,
      scope: tokens.scope
    }
  });
}

export async function revokeCalendarAccess(userId: string, env: AppEnv): Promise<void> {
  const stored = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!stored) return;

  const accessToken = decrypt(stored.encryptedAccessToken, env);
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(accessToken)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[google-calendar] Failed to revoke access token", {
      userId,
      errorMessage: message
    });
  }
  await prisma.googleCalendarToken.deleteMany({ where: { userId, firmId: stored.firmId } });
}

export async function getConnectionStatus(userId: string): Promise<{ connected: boolean; calendarId?: string }> {
  const stored = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  return stored
    ? { connected: true, calendarId: stored.calendarId }
    : { connected: false };
}

// ─── Calendar event operations ────────────────────────────────────────────────

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

async function calendarRequest(
  method: string,
  path: string,
  accessToken: string,
  body?: object
): Promise<unknown> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Calendar API ${method} ${path} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function pushHearingToCalendar(
  hearingId: string,
  userId: string,
  env: AppEnv
): Promise<void> {
  const accessToken = await getValidAccessToken(userId, env);
  if (!accessToken) return; // user not connected

  const stored = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!stored) return;

  const hearing = await prisma.caseSession.findUnique({
    where: { id: hearingId },
    include: { case: { select: { title: true, caseNumber: true } } }
  });
  if (!hearing) return;

  const calendarId = stored.calendarId;
  const event: CalendarEvent = {
    summary: `${hearing.case.title} (${hearing.case.caseNumber})`,
    description: hearing.notes ?? "",
    start: { dateTime: hearing.sessionDatetime.toISOString(), timeZone: "Africa/Cairo" },
    end: { dateTime: new Date(hearing.sessionDatetime.getTime() + 60 * 60 * 1000).toISOString(), timeZone: "Africa/Cairo" }
  };

  if (hearing.googleCalendarEventId) {
    // Update existing event
    await calendarRequest(
      "PUT",
      `/calendars/${encodeURIComponent(calendarId)}/events/${hearing.googleCalendarEventId}`,
      accessToken,
      event
    );
  } else {
    // Create new event
    const created = await calendarRequest(
      "POST",
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      accessToken,
      event
    ) as { id: string };
    await prisma.caseSession.update({
      where: { id: hearingId },
      data: { googleCalendarEventId: created.id }
    });
  }
}

export async function deleteHearingFromCalendar(
  hearingId: string,
  userId: string,
  env: AppEnv
): Promise<void> {
  const accessToken = await getValidAccessToken(userId, env);
  if (!accessToken) return;

  const stored = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!stored) return;

  const hearing = await prisma.caseSession.findUnique({ where: { id: hearingId } });
  if (!hearing?.googleCalendarEventId) return;

  try {
    await calendarRequest(
      "DELETE",
      `/calendars/${encodeURIComponent(stored.calendarId)}/events/${hearing.googleCalendarEventId}`,
      accessToken
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("(410)")) {
      console.warn("[google-calendar] Failed to delete hearing event", {
        hearingId,
        userId,
        eventId: hearing.googleCalendarEventId,
        errorMessage: message
      });
    }
  }

  await prisma.caseSession.update({
    where: { id: hearingId },
    data: { googleCalendarEventId: null }
  });
}
