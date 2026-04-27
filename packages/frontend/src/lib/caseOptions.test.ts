import { describe, expect, it } from "vitest";
import { toClientSelectOption } from "./caseOptions";

const t = ((key: string) => {
  if (key === "labels.poaNumber") return "Power of attorney number";
  if (key === "enums.ClientType.INDIVIDUAL") return "Individual";
  return key;
}) as unknown as Parameters<typeof toClientSelectOption>[0];

describe("toClientSelectOption", () => {
  it("formats label as name, type, and poa", () => {
    const option = toClientSelectOption(t, {
      id: "c-1",
      name: "Safaa",
      type: "INDIVIDUAL",
      poaNumber: "POA-123"
    });

    expect(option.label).toBe(
      "Safaa — Individual — Power of attorney number: POA-123"
    );
  });

  it("builds search text with metadata fields", () => {
    const option = toClientSelectOption(t, {
      id: "c-2",
      name: "Acme Co",
      type: "INDIVIDUAL",
      poaNumber: "",
      phone: "+201234567890",
      email: "acme@example.com",
      nationalId: "100200300",
      commercialRegister: "CR-77",
      taxNumber: "TAX-11"
    });

    expect(option.searchText).toContain("Acme Co");
    expect(option.searchText).toContain("INDIVIDUAL");
    expect(option.searchText).toContain("Individual");
    expect(option.searchText).toContain("+201234567890");
    expect(option.searchText).toContain("acme@example.com");
    expect(option.searchText).toContain("100200300");
    expect(option.searchText).toContain("CR-77");
    expect(option.searchText).toContain("TAX-11");
    expect(option.searchText).toContain("c-2");
  });
});
