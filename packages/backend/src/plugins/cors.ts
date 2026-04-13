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
  const isDesktopBootstrapRuntime = Boolean(process.env.ELMS_DESKTOP_BOOTSTRAP_TOKEN?.trim());

  const devOrigins: (string | RegExp)[] = [
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
    "tauri://localhost",
    "https://tauri.localhost",
    "http://tauri.localhost"
  ];
  const desktopFrontendOrigin = env.DESKTOP_FRONTEND_URL?.trim();
  if (desktopFrontendOrigin) {
    devOrigins.push(desktopFrontendOrigin);
  }

  const allowedOrigins: (string | RegExp)[] =
    env.NODE_ENV === "production" && !isDesktopBootstrapRuntime
      ? extraOrigins
      : [...devOrigins, ...extraOrigins];

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

      // Some Windows WebView contexts send Origin: null. Only allow this while
      // running the packaged desktop bootstrap runtime.
      if (origin === "null" && isDesktopBootstrapRuntime) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", LOCAL_SESSION_HEADER],
    exposedHeaders: ["set-cookie"],
    maxAge: env.NODE_ENV === "production" ? 3600 : 0
  });
}
