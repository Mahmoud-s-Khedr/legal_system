import cors from "@fastify/cors";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppEnv } from "../config/env.js";
import { LOCAL_SESSION_HEADER } from "../config/constants.js";

/** Header sent by Chromium/WebKit PNA preflights (formerly CORS-RFC1918). */
const PNA_REQUEST_HEADER = "access-control-request-private-network";
/** Response header that must be present to satisfy the PNA preflight. */
const PNA_ALLOW_HEADER = "Access-Control-Allow-Private-Network";

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
  const isLocalDesktopAuthMode = env.AUTH_MODE === "local";
  const trustedDesktopOrigins: (string | RegExp)[] = [
    "tauri://localhost",
    "https://tauri.localhost",
    "http://tauri.localhost",
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/
  ];

  const devOrigins: (string | RegExp)[] = [
    /^https?:\/\/localhost(?::\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
    ...trustedDesktopOrigins
  ];
  const desktopFrontendOrigin = env.DESKTOP_FRONTEND_URL?.trim();
  if (desktopFrontendOrigin) {
    devOrigins.push(desktopFrontendOrigin);
  }

  const allowedOrigins: (string | RegExp)[] =
    env.NODE_ENV === "production" && !isDesktopBootstrapRuntime
      ? [...trustedDesktopOrigins, ...extraOrigins]
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
      if (origin === "null" && (isDesktopBootstrapRuntime || isLocalDesktopAuthMode)) {
        callback(null, true);
        return;
      }

      app.log.warn(
        {
          origin,
          nodeEnv: env.NODE_ENV,
          authMode: env.AUTH_MODE,
          desktopBootstrapRuntime: isDesktopBootstrapRuntime,
          localDesktopAuthMode: isLocalDesktopAuthMode
        },
        "Rejected CORS origin"
      );
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Include the PNA request header so @fastify/cors does not strip it before
    // our onSend hook can inspect it.
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      LOCAL_SESSION_HEADER,
      PNA_REQUEST_HEADER
    ],
    exposedHeaders: ["set-cookie"],
    maxAge: env.NODE_ENV === "production" ? 3600 : 0
  });

  /**
   * Private Network Access (PNA) preflight hook — Chromium spec.
   *
   * When a secure origin (tauri://localhost) fetches a private-network address
   * (e.g. 192.168.x.x) the browser inserts a synthetic preflight that carries
   *   Access-Control-Request-Private-Network: true
   * and will only let the real request through if the response contains
   *   Access-Control-Allow-Private-Network: true
   *
   * Standard CORS headers alone are not sufficient — this extra echo is
   * required by the spec and enforced silently by the webview (no 4xx is
   * surfaced, the request is just blocked).
   */
  app.addHook(
    "onSend",
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.headers[PNA_REQUEST_HEADER] === "true") {
        app.log.info(
          {
            origin: req.headers.origin,
            method: req.method,
            url: req.url
          },
          "Private Network Access preflight detected — echoing Allow header"
        );
        reply.header(PNA_ALLOW_HEADER, "true");
      }
    }
  );
}
