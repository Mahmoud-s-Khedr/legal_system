/**
 * Client portal authentication routes.
 * Completely separate from the staff /api/auth routes.
 * Portal tokens use audience "elms-portal" to distinguish them from staff tokens.
 */
import { randomBytes, createHash } from "node:crypto";
import type { SignOptions, VerifyOptions } from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";

const PORTAL_COOKIE = "elms_portal_token";
const PORTAL_AUDIENCE = "elms-portal";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerPortalAuthRoutes(app: FastifyInstance, env: AppEnv) {
  // ── Login ────────────────────────────────────────────────────────────────────

  app.post("/api/portal/auth/login", async (request, reply) => {
    const { email, firmId, password } = request.body as { email: string; firmId: string; password: string };

    const client = await prisma.client.findFirst({
      where: { portalEmail: email, firmId, deletedAt: null }
    });

    if (!client?.portalPasswordHash) {
      return reply.status(401).send({ message: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, client.portalPasswordHash);
    if (!matches) {
      return reply.status(401).send({ message: "Invalid email or password" });
    }

    await prisma.client.updateMany({
      where: { id: client.id, firmId: client.firmId, deletedAt: null },
      data: { portalLastLoginAt: new Date() }
    });

    const token = await app.jwt.sign(
      { sub: client.id, firmId: client.firmId, clientId: client.id },
      {
        expiresIn: "7d",
        aud: PORTAL_AUDIENCE,
        iss: env.COOKIE_DOMAIN ?? "elms"
      } satisfies Partial<SignOptions>
    );

    return reply
      .setCookie(PORTAL_COOKIE, token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60
      })
      .send({ ok: true, clientId: client.id, firmId: client.firmId, name: client.name });
  });

  // ── Accept invite (set password) ─────────────────────────────────────────────

  app.post("/api/portal/invite/accept", async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };

    const tokenHash = hashToken(token);
    const invite = await prisma.clientPortalInvite.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }
    });

    if (!invite) {
      return reply.status(400).send({ message: "Invite link is invalid or expired" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const clientResult = await tx.client.updateMany({
        where: { id: invite.clientId, firmId: invite.firmId, deletedAt: null },
        data: { portalEmail: invite.email, portalPasswordHash: passwordHash }
      });

      const inviteResult = await tx.clientPortalInvite.updateMany({
        where: { id: invite.id, firmId: invite.firmId, usedAt: null },
        data: { usedAt: new Date() }
      });

      if (clientResult.count === 0 || inviteResult.count === 0) {
        throw new Error("Invite link is invalid or expired");
      }
    });

    return { ok: true };
  });

  // ── Logout ───────────────────────────────────────────────────────────────────

  app.post("/api/portal/auth/logout", async (_request, reply) => {
    return reply.clearCookie(PORTAL_COOKIE, { path: "/" }).send({ ok: true });
  });

  // ── Me ───────────────────────────────────────────────────────────────────────

  app.get("/api/portal/auth/me", async (request, reply) => {
    const token = request.cookies[PORTAL_COOKIE];
    if (!token) return reply.status(401).send({ message: "Not authenticated" });

    try {
      const payload = await app.jwt.verify<{ sub: string; firmId: string; clientId: string; aud: string }>(
        token,
        { allowedAud: PORTAL_AUDIENCE } satisfies Partial<VerifyOptions>
      );
      if (payload.aud !== PORTAL_AUDIENCE) return reply.status(401).send({ message: "Invalid token audience" });

      const client = await prisma.client.findFirst({
        where: { id: payload.clientId, firmId: payload.firmId, deletedAt: null }
      });
      if (!client) return reply.status(401).send({ message: "Client not found" });

      return { clientId: client.id, firmId: client.firmId, name: client.name };
    } catch {
      return reply.status(401).send({ message: "Invalid token" });
    }
  });

  // ── Send invite (firm admin) ─────────────────────────────────────────────────

  app.post(
    "/api/clients/:clientId/portal/invite",
    {
      preHandler: [
        // Must be authenticated staff
        async (request, reply) => {
          const user = request.sessionUser;
          if (!user) return reply.status(401).send({ message: "Unauthorized" });
          if (!user.permissions.includes("clients:manage") && !user.permissions.includes("clients:create")) {
            return reply.status(403).send({ message: "Forbidden" });
          }
        }
      ]
    },
    async (request, reply) => {
      const actor = request.sessionUser!;
      const { clientId } = request.params as { clientId: string };
      const { email } = request.body as { email: string };

      const client = await prisma.client.findFirst({
        where: { id: clientId, firmId: actor.firmId, deletedAt: null }
      });
      if (!client) return reply.status(404).send({ error: "Client not found" });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.clientPortalInvite.create({
        data: { clientId, firmId: actor.firmId, email, tokenHash, expiresAt }
      });

      // Return the raw token to the caller — they should email it to the client
      // (In production this would trigger the email notification channel)
      return reply.status(201).send({
        inviteToken: rawToken,
        inviteUrl: `/portal/accept-invite?token=${rawToken}`,
        expiresAt
      });
    }
  );

  // ── Revoke portal access (firm admin) ────────────────────────────────────────

  app.delete(
    "/api/clients/:clientId/portal/access",
    {
      preHandler: [
        async (request, reply) => {
          const user = request.sessionUser;
          if (!user) return reply.status(401).send({ message: "Unauthorized" });
          if (!user.permissions.includes("clients:manage") && !user.permissions.includes("clients:create")) {
            return reply.status(403).send({ message: "Forbidden" });
          }
        }
      ]
    },
    async (request) => {
      const actor = request.sessionUser!;
      const { clientId } = request.params as { clientId: string };

      await prisma.client.updateMany({
        where: { id: clientId, firmId: actor.firmId },
        data: { portalPasswordHash: null, portalEmail: null, portalLastLoginAt: null }
      });
      await prisma.clientPortalInvite.deleteMany({ where: { clientId, firmId: actor.firmId } });

      return { success: true };
    }
  );
}
