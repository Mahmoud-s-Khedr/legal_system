import { z } from "zod";

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters.";

export const newPasswordSchema = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE);
