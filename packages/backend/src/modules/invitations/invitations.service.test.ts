import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvitationDb = {
  count: vi.fn(),
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};

const mockUserDb = { count: vi.fn() };
const mockPrisma = { invitation: mockInvitationDb, user: mockUserDb };

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../auth/inviteToken.js", () => ({ createInvitationToken: vi.fn(() => "tok-abc123") }));

const { listInvitations, createInvitation, revokeInvitation } = await import(
  "./invitations.service.js"
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  email: "admin@elms.test",
  fullName: "Test Admin",
  permissions: ["invitations:create", "invitations:read", "invitations:revoke"]
});

const audit = { actor };
const now = new Date("2026-03-21T00:00:00.000Z");
const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);

function makeInvitationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "invite-1",
    email: "lawyer@example.com",
    token: "tok-abc123",
    status: "PENDING",
    expiresAt: expires,
    acceptedAt: null,
    createdAt: now,
    roleId: "role-lawyer",
    role: { name: "Junior Lawyer" },
    ...overrides
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUserDb.count.mockResolvedValue(0);
  mockInvitationDb.count.mockResolvedValue(0);
});

describe("listInvitations", () => {
  it("returns paginated invitations for the firm", async () => {
    mockInvitationDb.count.mockResolvedValue(1);
    mockInvitationDb.findMany.mockResolvedValue([makeInvitationRecord()]);

    const result = await listInvitations(actor, { page: 1, limit: 50 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBe("lawyer@example.com");
    expect(result.items[0].status).toBe("PENDING");
  });

  it("filters by firmId for tenant isolation", async () => {
    mockInvitationDb.count.mockResolvedValue(0);
    mockInvitationDb.findMany.mockResolvedValue([]);

    await listInvitations(actor);

    expect(mockInvitationDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1" })
      })
    );
  });
});

describe("createInvitation", () => {
  it("creates an invitation with PENDING status and a token", async () => {
    const record = makeInvitationRecord();
    mockInvitationDb.create.mockResolvedValue(record);

    const { writeAuditLog } = await import("../../services/audit.service.js");

    const result = await createInvitation(
      actor,
      { email: "lawyer@example.com", roleId: "role-lawyer" },
      audit
    );

    expect(result.email).toBe("lawyer@example.com");
    expect(result.status).toBe("PENDING");
    expect(result.token).toBe("tok-abc123");
    expect(mockInvitationDb.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firmId: "firm-1",
          email: "lawyer@example.com",
          token: "tok-abc123",
          status: "PENDING"
        })
      })
    );
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("sets expiry 48 hours from creation time", async () => {
    mockInvitationDb.create.mockResolvedValue(makeInvitationRecord());

    await createInvitation(actor, { email: "x@x.com", roleId: "role-1" }, audit);

    const createCall = mockInvitationDb.create.mock.calls[0][0];
    const expiresAt: Date = createCall.data.expiresAt;
    const diffHours = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    // Should be approximately 48 hours (allow ±1 second tolerance)
    expect(diffHours).toBeGreaterThan(47.9);
    expect(diffHours).toBeLessThan(48.1);
  });
});

describe("revokeInvitation", () => {
  it("updates invitation status to REVOKED", async () => {
    const existing = makeInvitationRecord({ status: "PENDING" });
    const revoked = makeInvitationRecord({ status: "REVOKED" });
    mockInvitationDb.findFirstOrThrow.mockResolvedValue(existing);
    mockInvitationDb.update.mockResolvedValue(revoked);

    const result = await revokeInvitation(actor, "invite-1", audit);

    expect(result.status).toBe("REVOKED");
    expect(mockInvitationDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invite-1" },
        data: expect.objectContaining({ status: "REVOKED" })
      })
    );
  });

  it("enforces firmId scope when finding the invitation", async () => {
    mockInvitationDb.findFirstOrThrow.mockResolvedValue(makeInvitationRecord());
    mockInvitationDb.update.mockResolvedValue(makeInvitationRecord({ status: "REVOKED" }));

    await revokeInvitation(actor, "invite-1", audit);

    expect(mockInvitationDb.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "invite-1", firmId: "firm-1" })
      })
    );
  });
});
