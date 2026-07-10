import "fastify";
import type { AppEnv } from "../config/env.js";
import type { SessionUser } from "@elms/shared";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import type { OperatorSessionUser } from "../modules/operator/operator.types.js";

declare module "fastify" {
  interface FastifyInstance {
    appEnv: AppEnv;
    storage: IStorageAdapter;
  }

  interface FastifyRequest {
    sessionUser: SessionUser | null;
    operatorUser: OperatorSessionUser | null;
    startTime?: bigint;
  }
}
