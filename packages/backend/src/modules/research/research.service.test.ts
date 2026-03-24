import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditionKey } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockResearchSession = {
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn()
};

const mockResearchMessage = {
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn()
};

const mockFirm = {
  findUniqueOrThrow: vi.fn()
};

const mockPrisma = {
  researchSession: mockResearchSession,
  researchMessage: mockResearchMessage,
  firm: mockFirm
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../config/env.js", () => ({
  loadEnv: vi.fn(() => ({ AI_MONTHLY_LIMIT: 0, OCR_BACKEND: "tesseract" }))
}));
vi.mock("../editions/editionPolicy.js", () => ({
  hasEditionFeature: vi.fn(),
  getAiMonthlyLimit: vi.fn()
}));
vi.mock("./ai.provider.js", () => ({
  streamMessage: vi.fn()
}));
vi.mock("./retrieval.service.js", () => ({
  retrieveRelevantExcerpts: vi.fn().mockResolvedValue([])
}));

const {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  checkUsageLimit
} = await import("./research.service.js");

const { hasEditionFeature, getAiMonthlyLimit } = await import("../editions/editionPolicy.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  roleKey: "senior_lawyer",
  email: "lawyer@elms.test",
  fullName: "Senior Lawyer",
  editionKey: EditionKey.SOLO_ONLINE,
  permissions: ["research:use"]
});

const now = new Date("2026-03-21T00:00:00.000Z");

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "session-1",
    firmId: "firm-1",
    userId: "user-1",
    caseId: null,
    title: null,
    createdAt: now,
    updatedAt: now,
    messages: [],
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasEditionFeature).mockReturnValue(true);
  vi.mocked(getAiMonthlyLimit).mockReturnValue(500);
});

// ── createSession ─────────────────────────────────────────────────────────────

describe("createSession", () => {
  it("creates session scoped to actor firm and user", async () => {
    mockResearchSession.create.mockResolvedValue(makeSession());

    const result = await createSession(actor);

    expect(mockResearchSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "firm-1", userId: "user-1" })
      })
    );
    expect(result.id).toBe("session-1");
  });

  it("stores optional caseId and title", async () => {
    mockResearchSession.create.mockResolvedValue(makeSession({ caseId: "case-1", title: "Research on contract law" }));

    await createSession(actor, "case-1", "Research on contract law");

    expect(mockResearchSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseId: "case-1", title: "Research on contract law" })
      })
    );
  });

  it("stores null for optional fields when not provided", async () => {
    mockResearchSession.create.mockResolvedValue(makeSession());

    await createSession(actor);

    expect(mockResearchSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ caseId: null, title: null })
      })
    );
  });
});

// ── listSessions ──────────────────────────────────────────────────────────────

describe("listSessions", () => {
  it("returns sessions filtered by both firmId and userId", async () => {
    mockResearchSession.findMany.mockResolvedValue([makeSession()]);

    const result = await listSessions(actor);

    expect(mockResearchSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", userId: "user-1" })
      })
    );
    expect(result).toHaveLength(1);
  });

  it("limits results to 50 sessions", async () => {
    mockResearchSession.findMany.mockResolvedValue([]);

    await listSessions(actor);

    expect(mockResearchSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });
});

// ── getSession ────────────────────────────────────────────────────────────────

describe("getSession", () => {
  it("returns session with messages for actor's firm", async () => {
    const session = makeSession({
      messages: [{ id: "msg-1", role: "USER", content: "What is article 123?", sources: [] }]
    });
    mockResearchSession.findFirst.mockResolvedValue(session);

    const result = await getSession(actor, "session-1");

    expect(mockResearchSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "session-1", firmId: "firm-1" })
      })
    );
    expect(result).not.toBeNull();
  });

  it("returns null when session belongs to different firm", async () => {
    mockResearchSession.findFirst.mockResolvedValue(null);

    const result = await getSession(actor, "session-from-other-firm");

    expect(result).toBeNull();
  });
});

// ── deleteSession ─────────────────────────────────────────────────────────────

describe("deleteSession", () => {
  it("returns true when session is deleted successfully", async () => {
    mockResearchSession.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteSession(actor, "session-1");

    expect(result).toBe(true);
    expect(mockResearchSession.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "session-1", firmId: "firm-1", userId: "user-1" })
      })
    );
  });

  it("returns false when session not found or belongs to another user", async () => {
    mockResearchSession.deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteSession(actor, "session-not-mine");

    expect(result).toBe(false);
  });
});

// ── checkUsageLimit ───────────────────────────────────────────────────────────

describe("checkUsageLimit", () => {
  it("returns not allowed for editions without ai_research feature", async () => {
    vi.mocked(hasEditionFeature).mockReturnValue(false);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_OFFLINE });

    const result = await checkUsageLimit("firm-1");

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(0);
  });

  it("returns allowed:true when usage is below monthly limit", async () => {
    vi.mocked(hasEditionFeature).mockReturnValue(true);
    vi.mocked(getAiMonthlyLimit).mockReturnValue(500);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_ONLINE });
    mockResearchMessage.count.mockResolvedValue(50); // 50 of 500 used

    const result = await checkUsageLimit("firm-1");

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(50);
    expect(result.limit).toBe(500);
  });

  it("returns allowed:false when usage meets or exceeds monthly limit", async () => {
    vi.mocked(hasEditionFeature).mockReturnValue(true);
    vi.mocked(getAiMonthlyLimit).mockReturnValue(500);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.SOLO_ONLINE });
    mockResearchMessage.count.mockResolvedValue(500); // exactly at limit

    const result = await checkUsageLimit("firm-1");

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(500);
  });

  it("counts only USER messages from current month for usage", async () => {
    vi.mocked(hasEditionFeature).mockReturnValue(true);
    vi.mocked(getAiMonthlyLimit).mockReturnValue(2000);
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.LOCAL_FIRM_ONLINE });
    mockResearchMessage.count.mockResolvedValue(100);

    await checkUsageLimit("firm-1");

    // Verify count query filters on role USER and firmId
    expect(mockResearchMessage.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "USER",
          session: expect.objectContaining({ firmId: "firm-1" })
        })
      })
    );
  });

  it("returns allowed:true with limit:0 for unlimited enterprise tier", async () => {
    vi.mocked(hasEditionFeature).mockReturnValue(true);
    vi.mocked(getAiMonthlyLimit).mockReturnValue(null as never); // enterprise: null = unlimited
    mockFirm.findUniqueOrThrow.mockResolvedValue({ editionKey: EditionKey.ENTERPRISE });

    const result = await checkUsageLimit("firm-1");

    // When limit is 0 (unlimited), always allowed and no message count needed
    expect(result.allowed).toBe(true);
  });
});
