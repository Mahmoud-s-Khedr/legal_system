import type { ApiListResponse } from "../types/common";

export interface HearingDto {
  id: string;
  caseId: string;
  caseTitle: string;
  assignedLawyerId: string | null;
  assignedLawyerName: string | null;
  sessionDatetime: string;
  nextSessionAt: string | null;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHearingDto {
  caseId: string;
  assignedLawyerId?: string | null;
  sessionDatetime: string;
  nextSessionAt?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

export type UpdateHearingDto = CreateHearingDto;

export interface UpdateHearingOutcomeDto {
  outcome: string | null;
}

export interface HearingConflictDto {
  hasConflict: boolean;
  conflictingHearingIds: string[];
}

export type HearingListResponseDto = ApiListResponse<HearingDto>;
