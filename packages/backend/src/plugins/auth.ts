import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";

export async function registerJwtPlugin(app: FastifyInstance, env: AppEnv) {
  await app.register(jwt, {
    secret: {
      private: env.JWT_PRIVATE_KEY,
      public: env.JWT_PUBLIC_KEY
    },
    sign: {
      algorithm: "RS256"
    }
  });
}
