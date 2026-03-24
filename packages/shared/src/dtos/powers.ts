import { PoaStatus, PoaType } from "../enums/index";
import type { ApiListResponse } from "../types/common";

export interface PowerOfAttorneyDto {
  id: string;
  firmId: string;
  clientId: string;
  clientName: string;
  caseId: string | null;
  number: string | null;
  type: PoaType;
  status: PoaStatus;
  issuedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  scopeTextAr: string | null;
  hasSelfContractClause: boolean;
  commercialRegisterId: string | null;
  agentCertExpiry: string | null;
  agentResidencyStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePowerOfAttorneyDto {
  clientId: string;
  caseId?: string | null;
  number?: string | null;
  type: PoaType;
  issuedAt?: string | null;
  expiresAt?: string | null;
  scopeTextAr?: string | null;
  hasSelfContractClause?: boolean;
  commercialRegisterId?: string | null;
  agentCertExpiry?: string | null;
  agentResidencyStatus?: string | null;
}

export interface UpdatePowerOfAttorneyDto {
  number?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  scopeTextAr?: string | null;
  hasSelfContractClause?: boolean;
  commercialRegisterId?: string | null;
  agentCertExpiry?: string | null;
  agentResidencyStatus?: string | null;
}

export interface RevokePowerOfAttorneyDto {
  reason?: string | null;
}

export type PowerOfAttorneyListResponseDto = ApiListResponse<PowerOfAttorneyDto>;
