import { randomBytes } from "node:crypto";

export function createInvitationToken() {
  return randomBytes(24).toString("hex");
}
