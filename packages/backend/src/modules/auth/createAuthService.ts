import { AuthMode } from "@elms/shared";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import type { AuthService } from "./auth.types.js";
import { createLocalAuthService } from "./localAuthService.js";

export function createAuthService(app: FastifyInstance, env: AppEnv): AuthService {
  if (env.AUTH_MODE !== AuthMode.LOCAL) {
    app.log.warn(
      {
        configuredAuthMode: env.AUTH_MODE
      },
      "Cloud auth mode is deprecated and non-operational; local auth service forced"
    );
  }

  return createLocalAuthService(env);
}
