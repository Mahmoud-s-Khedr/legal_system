import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";

export async function registerCorsPlugin(app: FastifyInstance, env: AppEnv) {
  const extraOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const devOrigins: (string | RegExp)[] = [/localhost$/, /127\.0\.0\.1$/];
  const allowedOrigins: (string | RegExp)[] =
    env.NODE_ENV === "production" ? extraOrigins : [...devOrigins, ...extraOrigins];

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["set-cookie"],
    maxAge: env.NODE_ENV === "production" ? 3600 : 0
  });
}
