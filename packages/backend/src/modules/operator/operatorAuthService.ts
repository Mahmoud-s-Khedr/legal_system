import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { appError } from "../../errors/appError.js";
import { getOperatorJwt } from "../../plugins/operatorAuth.js";
import type { OperatorLoginDto, OperatorSessionUser } from "./operator.types.js";

export function createOperatorAuthService(app: FastifyInstance, env: AppEnv) {
  return {
    async login(payload: OperatorLoginDto): Promise<{ accessToken: string; operator: OperatorSessionUser }> {
      const operator = await prisma.operatorUser.findUnique({
        where: { email: payload.email }
      });

      if (!operator) {
        throw appError("Invalid email or password", 401);
      }

      const matches = await bcrypt.compare(payload.password, operator.passwordHash);
      if (!matches) {
        throw appError("Invalid email or password", 401);
      }

      if (operator.status !== "ACTIVE") {
        throw appError("This operator account is suspended", 403, {
          code: "OPERATOR_SUSPENDED"
        });
      }

      await prisma.operatorUser.update({
        where: { id: operator.id },
        data: { lastLoginAt: new Date() }
      });

      const sessionUser: OperatorSessionUser = {
        id: operator.id,
        email: operator.email,
        displayName: operator.displayName,
        status: operator.status
      };

      const accessToken = await getOperatorJwt(app).sign(
        {
          sub: operator.id,
          email: operator.email,
          displayName: operator.displayName
        },
        {
          expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
          aud: "elms-operator"
        }
      );

      return { accessToken, operator: sessionUser };
    }
  };
}
