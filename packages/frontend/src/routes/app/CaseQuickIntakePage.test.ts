import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CaseRoleOnCase, ClientType, TaskPriority } from "@elms/shared";
import {
  isIdentityType,
  isPartyPristine,
  isQuickIntakeDirty,
  normalizeClientPayload,
  toNullable
} from "./CaseQuickIntakePage";

function baseState(): Parameters<typeof isQuickIntakeDirty>[0] {
  return {
    caseForm: {
      title: "",
      caseNumber: ""
    },
    existingClientId: "",
    clientForm: {
      name: ""
    },
    courts: [
      {
        id: "court-1",
        courtName: "",
        courtLevel: "",
        circuit: "",
        caseNumber: "",
        startedAt: "",
        notes: ""
      }
    ],
    parties: [
      {
        id: "party-1",
        name: "",
        role: "PLAINTIFF",
        partyType: "OPPONENT" as const,
        clientId: ""
      }
    ],
    assignments: [
      {
        id: "assignment-1",
        userId: "",
        roleOnCase: CaseRoleOnCase.LEAD
      }
    ],
    hearings: [
      {
        id: "hearing-1",
        assignedLawyerId: "",
        sessionDatetime: "",
        nextSessionAt: "",
        outcome: "" as const,
        notes: ""
      }
    ],
    tasks: [
      {
        id: "task-1",
        title: "",
        description: "",
        priority: TaskPriority.MEDIUM,
        assignedToId: "",
        dueAt: ""
      }
    ],
    documents: [
      {
        id: "document-1",
        title: "",
        type: "GENERAL",
        file: null
      }
    ]
  };
}

describe("quick intake dirty state", () => {
  it("normalizes nullable text values", () => {
    expect(toNullable("   ")).toBeNull();
    expect(toNullable("  value  ")).toBe("value");
  });

  it("detects identity client types and normalizes payload by type", () => {
    expect(isIdentityType(ClientType.INDIVIDUAL)).toBe(true);
    expect(isIdentityType(ClientType.GOVERNMENT)).toBe(true);
    expect(isIdentityType(ClientType.COMPANY)).toBe(false);

    expect(
      normalizeClientPayload({
        name: "  ACME  ",
        type: ClientType.COMPANY,
        phone: " 010 ",
        email: "  ",
        governorate: " Cairo ",
        preferredLanguage: "ar",
        nationalId: " 123 ",
        commercialRegister: " 999 ",
        taxNumber: " 888 ",
        contacts: []
      })
    ).toMatchObject({
      name: "ACME",
      nationalId: null,
      commercialRegister: "999",
      taxNumber: "888"
    });
  });

  it("treats default party row as pristine", () => {
    const party = baseState().parties[0];
    expect(isPartyPristine(party)).toBe(true);
  });

  it("is clean on first render defaults", () => {
    expect(isQuickIntakeDirty(baseState())).toBe(false);
  });

  it("becomes dirty when party role changes from default and clean again when reverted", () => {
    const state = baseState();
    state.parties[0] = { ...state.parties[0], role: "DEFENDANT" };
    expect(isQuickIntakeDirty(state)).toBe(true);

    state.parties[0] = { ...state.parties[0], role: "PLAINTIFF" };
    expect(isQuickIntakeDirty(state)).toBe(false);
  });

  it("sets unsaved-change bypass helper immediately before success navigation", () => {
    const source = readFileSync(resolve(process.cwd(), "src/routes/app/CaseQuickIntakePage.tsx"), "utf8");

    expect(source).toContain("useUnsavedChangesBypass()");
    expect(source).toContain("useUnsavedChanges(quickIntakeDirty, { bypassBlockRef: bypassRef })");

    const bypassIndex = source.indexOf("allowNextNavigation();");
    const navigateIndex = source.indexOf('navigate({ to: "/app/cases/$caseId", params: { caseId } })');
    expect(bypassIndex).toBeGreaterThan(-1);
    expect(navigateIndex).toBeGreaterThan(-1);
    expect(bypassIndex).toBeLessThan(navigateIndex);
  });

  it("uses expanded safe image/scanner accept types for quick intake documents", () => {
    const source = readFileSync(resolve(process.cwd(), "src/routes/app/CaseQuickIntakePage.tsx"), "utf8");
    expect(source).toContain('accept=".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif"');
  });
});
