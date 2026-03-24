import type { FastifyInstance } from "fastify";
import * as Sentry from "@sentry/node";
import type { AppEnv } from "../config/env.js";

let initialized = false;

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|nationalid|fullname|name|email|phone|case|document|content|body)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (value == null || depth > 6) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : scrub(nested, depth + 1);
    }
    return output;
  }

  return value;
}

function scrubHeaders(headers: Record<string, unknown>) {
  const output = { ...headers };
  for (const key of Object.keys(output)) {
    if (/^(authorization|cookie|set-cookie|x-api-key)$/i.test(key)) {
      output[key] = "[REDACTED]";
    }
  }
  return output;
}

export function initializeBackendMonitoring(env: AppEnv, app?: FastifyInstance) {
  if (!env.SENTRY_DSN || initialized) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    beforeSend(event) {
      const next = scrub(event) as Sentry.ErrorEvent;
      if (next.request?.headers) {
        next.request.headers = scrubHeaders(next.request.headers as Record<string, unknown>) as Record<string, string>;
      }
      return next;
    }
  });

  if (app) {
    app.addHook("onClose", async () => {
      await Sentry.close(2_000);
    });
  }

  initialized = true;
}

export function captureBackendException(error: unknown) {
  Sentry.captureException(error);
}
