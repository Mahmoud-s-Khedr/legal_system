import { describe, expect, it } from "vitest";
import {
  isValidPhoneNumber,
  normalizeDigits,
  normalizePhoneNumber
} from "./text";

describe("text utils", () => {
  it("normalizes Arabic-Indic and Eastern Arabic digits", () => {
    expect(normalizeDigits("رقم ١٢٣ و ۴۵۶")).toBe("رقم 123 و 456");
  });

  it("normalizes phone number and trims whitespace", () => {
    expect(normalizePhoneNumber("  +٢٠١٢٣٤٥٦٧٨٩  ")).toBe("+20123456789");
  });

  it("validates normalized phone numbers", () => {
    expect(isValidPhoneNumber("+٢٠١٢٣٤٥٦٧٨٩")).toBe(true);
    expect(isValidPhoneNumber("1234567")).toBe(true);
    expect(isValidPhoneNumber("12-34")).toBe(false);
  });
});
