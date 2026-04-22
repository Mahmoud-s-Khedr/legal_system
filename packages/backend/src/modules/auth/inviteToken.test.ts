import { describe, expect, it } from "vitest";
import { createInvitationToken } from "./inviteToken.js";

describe("createInvitationToken", () => {
  it("returns hex token with expected length", () => {
    const token = createInvitationToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token).toHaveLength(48);
  });
});
