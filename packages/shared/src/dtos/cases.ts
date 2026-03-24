import { CaseRoleOnCase, CaseStatus } from "../enums/index";
import type { ApiListResponse } from "../types/common";

export interface CaseAssignmentDto {
  id: string;
  userId: string;
  userName: string;
  roleOnCase: CaseRoleOnCase;
  assignedAt: string;
  unassignedAt: string | null;
}

export interface CasePartyDto {
  id: string;
  clientId: string | null;
  name: string;
  role: string;
  isOurClient: boolean;
  opposingCounselName: string | null;
}

export interface CaseStatusHistoryDto {
  id: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  changedAt: string;
  note: string | null;
}

export interface CaseCourtDto {
  id: string;
  caseId: string;
  courtName: string;
  courtLevel: string;
  circuit: string | null;
  caseNumber: string | null;
  stageOrder: number;
  startedAt: string | null;
  endedAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDto {
  id: string;
  clientId: string | null;
  title: string;
  caseNumber: string;
  internalReference: string | null;
  judicialYear: number | null;
  type: string;
  status: CaseStatus;
  courts: CaseCourtDto[];
  assignments: CaseAssignmentDto[];
  parties: CasePartyDto[];
  statusHistory: CaseStatusHistoryDto[];
  hearingCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseDto {
  clientId: string;
  title: string;
  caseNumber: string;
  internalReference?: string | null;
  judicialYear?: number | null;
  type: string;
}

export type UpdateCaseDto = Omit<CreateCaseDto, "clientId"> & { clientId?: string };

export interface ChangeCaseStatusDto {
  status: CaseStatus;
  note?: string | null;
}

export interface CreateCasePartyDto {
  clientId?: string | null;
  name: string;
  role: string;
  isOurClient: boolean;
  opposingCounselName?: string | null;
}

export interface CreateCaseAssignmentDto {
  userId: string;
  roleOnCase: CaseRoleOnCase;
}

export interface CreateCaseCourtDto {
  courtName: string;
  courtLevel: string;
  circuit?: string | null;
  caseNumber?: string | null;
  stageOrder?: number;
  startedAt?: string | null;
  notes?: string | null;
}

export interface UpdateCaseCourtDto {
  courtName: string;
  courtLevel: string;
  circuit?: string | null;
  caseNumber?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  isActive: boolean;
  notes?: string | null;
}

export interface ReorderCaseCourtsDto {
  orderedIds: string[];
}

export type CaseListResponseDto = ApiListResponse<CaseDto>;

/** Returned alongside case/party create operations when a conflict-of-interest is detected */
export interface ConflictWarningDto {
  /** Name of the party or client that caused the conflict */
  name: string;
  /** ID of the existing case where this party/client appears as an opposing party */
  conflictingCaseId: string;
  /** Title of that case */
  conflictingCaseTitle: string;
}
