import { AuthMode } from "@elms/shared";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import type { AuthService } from "./auth.types.js";
import { createCloudAuthService } from "./cloudAuthService.js";
import { createLocalAuthService } from "./localAuthService.js";

export function createAuthService(app: FastifyInstance, env: AppEnv): AuthService {
  if (env.AUTH_MODE === AuthMode.LOCAL) {
    return createLocalAuthService(env);
  }

  return createCloudAuthService(app, env);
}
