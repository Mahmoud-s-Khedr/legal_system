import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";

export async function registerMultipartPlugin(app: FastifyInstance, env: AppEnv) {
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_BYTES
    }
  });
}
