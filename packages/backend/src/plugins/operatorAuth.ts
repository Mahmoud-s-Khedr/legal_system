import jwt from "@fastify/jwt";
import type { SignOptions, VerifyOptions } from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";

interface OperatorJwtNamespace {
  sign(payload: object, options?: Partial<SignOptions>): Promise<string>;
  verify<Decoded>(token: string, options?: Partial<VerifyOptions>): Promise<Decoded>;
}

// The tenant (non-namespaced) JWT plugin must be registered before this one —
// @fastify/jwt attaches namespaced verifiers onto the same `app.jwt` object,
// and throws "already added" if the plain `jwt` decorator is registered second.
export async function registerOperatorJwtPlugin(app: FastifyInstance, env: AppEnv) {
  await app.register(jwt, {
    namespace: "operator",
    secret: {
      private: env.OPERATOR_JWT_PRIVATE_KEY,
      public: env.OPERATOR_JWT_PUBLIC_KEY
    },
    sign: {
      algorithm: "RS256"
    }
  });
}

export function getOperatorJwt(app: FastifyInstance): OperatorJwtNamespace {
  return (app.jwt as unknown as { operator: OperatorJwtNamespace }).operator;
}
