import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { EditionKey } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUser = {
  count: vi.fn(),
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};
const mockAuditLog = { create: vi.fn() };

const mockPrisma = { user: mockUser, auditLog: mockAuditLog };

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("bcryptjs");
vi.mock("../editions/editionPolicy.js", () => ({ assertCanCreateLocalUser: vi.fn() }));

// mapUser relies on toSessionUser / getUserWithRoleAndPermissions — mock the auth module
vi.mock("../auth/sessionUser.js", () => ({
  getUserWithRoleAndPermissions: vi.fn(),
  userWithRoleInclude: {
    firm: true,
    role: {
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    }
  },
  toSessionUser: vi.fn((user: Record<string, unknown>) => ({
    ...makeSessionUser({
      id: user.id as string,
      firmId: user.firmId as string,
      roleId: user.roleId as string,
      roleKey: "firm_admin",
      email: user.email as string,
      fullName: user.fullName as string,
      preferredLanguage: user.preferredLanguage as string,
      permissions: ["users:read", "users:create", "users:update", "users:delete"]
    })
  }))
}));

const { listUsers, createLocalUser, changeOwnPassword, adminSetPassword } = await import("./users.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  id: "user-admin",
  roleId: "role-admin",
  email: "admin@elms.test",
  fullName: "Admin User",
  permissions: ["users:read", "users:create", "users:update", "users:delete"]
});

const audit = { actor };
const now = new Date("2026-03-21T00:00:00.000Z");

function makeUserRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    firmId: "firm-1",
    email: "lawyer@elms.test",
    fullName: "Test Lawyer",
    passwordHash: "$2b$12$hashedpassword",
    roleId: "role-1",
    preferredLanguage: "AR",
    status: "ACTIVE",
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    firm: {
      editionKey: EditionKey.ENTERPRISE,
      lifecycleStatus: "ACTIVE",
      trialEndsAt: null,
      graceEndsAt: null
    },
    role: {
      key: "senior_lawyer",
      permissions: [{ permission: { key: "cases:read" } }]
    },
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(bcrypt.hash).mockResolvedValue("$2b$12$newhash" as never);
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
});

// ── listUsers ──────────────────────────────────────────────────────────────────

describe("listUsers", () => {
  it("returns paginated users for the firm", async () => {
    mockUser.count.mockResolvedValue(2);
    mockUser.findMany.mockResolvedValue([makeUserRecord(), makeUserRecord({ id: "user-2", email: "other@elms.test" })]);

    const result = await listUsers(actor, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("excludes soft-deleted users", async () => {
    mockUser.count.mockResolvedValue(0);
    mockUser.findMany.mockResolvedValue([]);

    await listUsers(actor, { page: 1, limit: 20 });

    expect(mockUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", deletedAt: null })
      })
    );
  });

  it("applies pagination correctly", async () => {
    mockUser.count.mockResolvedValue(30);
    mockUser.findMany.mockResolvedValue([]);

    await listUsers(actor, { page: 2, limit: 10 });

    expect(mockUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

// ── createLocalUser ────────────────────────────────────────────────────────────

describe("createLocalUser", () => {
  it("hashes password with bcrypt cost 12", async () => {
    mockUser.create.mockResolvedValue(makeUserRecord());

    await createLocalUser(actor, { email: "new@elms.test", fullName: "New User", password: "P@ssw0rd!", roleId: "role-1" }, audit);

    expect(bcrypt.hash).toHaveBeenCalledWith("P@ssw0rd!", 12);
  });

  it("creates user with ACTIVE status", async () => {
    mockUser.create.mockResolvedValue(makeUserRecord());

    await createLocalUser(actor, { email: "new@elms.test", fullName: "New User", password: "P@ssw0rd!", roleId: "role-1" }, audit);

    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "firm-1", status: "ACTIVE" })
      })
    );
  });
});

// ── changeOwnPassword ──────────────────────────────────────────────────────────

describe("changeOwnPassword", () => {
  it("verifies current password before updating", async () => {
    mockUser.findFirstOrThrow.mockResolvedValue(makeUserRecord());
    mockUser.update = vi.fn().mockResolvedValue({});

    await changeOwnPassword(actor, { currentPassword: "OldP@ss!", newPassword: "NewP@ss!" }, audit);

    expect(bcrypt.compare).toHaveBeenCalledWith("OldP@ss!", "$2b$12$hashedpassword");
  });

  it("rejects update when current password is incorrect", async () => {
    mockUser.findFirstOrThrow.mockResolvedValue(makeUserRecord());
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      changeOwnPassword(actor, { currentPassword: "WrongPass!", newPassword: "NewP@ss!" }, audit)
    ).rejects.toThrow("Current password is incorrect");
  });

  it("rejects if user has no password set (SSO account)", async () => {
    mockUser.findFirstOrThrow.mockResolvedValue(makeUserRecord({ passwordHash: null }));

    await expect(
      changeOwnPassword(actor, { currentPassword: "any", newPassword: "NewP@ss!" }, audit)
    ).rejects.toThrow("Password update is unavailable for this account");
  });
});

// ── adminSetPassword ───────────────────────────────────────────────────────────

describe("adminSetPassword", () => {
  it("sets new password without requiring current password", async () => {
    mockUser.findFirstOrThrow.mockResolvedValue(makeUserRecord({ id: "user-target" }));
    mockUser.update = vi.fn().mockResolvedValue({});

    await adminSetPassword(actor, "user-target", { newPassword: "AdminSet123!" }, audit);

    expect(bcrypt.hash).toHaveBeenCalledWith("AdminSet123!", 12);
    expect(mockUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: "$2b$12$newhash" }) })
    );
  });

  it("rejects if actor lacks users:update permission", async () => {
    const restrictedActor = { ...actor, permissions: ["users:read"] };

    await expect(
      adminSetPassword(restrictedActor, "user-target", { newPassword: "AdminSet123!" }, audit)
    ).rejects.toThrow("You do not have permission to update user passwords");
  });
});
