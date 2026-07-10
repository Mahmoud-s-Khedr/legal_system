import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";
import { LOCAL_SESSION_HEADER } from "../config/constants.js";

function originMatches(origin: string, allowedOrigins: Array<string | RegExp>) {
  return allowedOrigins.some((candidate) =>
    typeof candidate === "string" ? candidate === origin : candidate.test(origin)
  );
}

export async function registerCorsPlugin(app: FastifyInstance, env: AppEnv) {
  const extraOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const frontendAppUrl = env.FRONTEND_APP_URL?.trim();

  const devOrigins: (string | RegExp)[] = [
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/
  ];

  const allowedOrigins: (string | RegExp)[] =
    env.NODE_ENV === "production"
      ? [...(frontendAppUrl ? [frontendAppUrl] : []), ...extraOrigins]
      : [...devOrigins, ...(frontendAppUrl ? [frontendAppUrl] : []), ...extraOrigins];

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (originMatches(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      app.log.warn(
        {
          origin,
          nodeEnv: env.NODE_ENV,
          authMode: env.AUTH_MODE
        },
        "Rejected CORS origin"
      );
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", LOCAL_SESSION_HEADER],
    exposedHeaders: ["set-cookie"],
    maxAge: env.NODE_ENV === "production" ? 3600 : 0
  });
}
