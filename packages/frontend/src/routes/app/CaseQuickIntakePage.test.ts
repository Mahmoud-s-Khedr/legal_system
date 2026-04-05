import { describe, expect, it } from "vitest";
import { CaseRoleOnCase, TaskPriority } from "@elms/shared";
import { isPartyPristine, isQuickIntakeDirty } from "./CaseQuickIntakePage";

function baseState() {
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
        isOurClient: true,
        opposingCounselName: ""
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
});
