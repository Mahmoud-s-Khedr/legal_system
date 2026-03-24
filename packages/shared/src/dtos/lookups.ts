import type { ApiListResponse } from "../types/common";

export interface LookupOptionDto {
  id: string;
  firmId: string | null;
  entity: string;
  key: string;
  labelAr: string;
  labelEn: string;
  labelFr: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLookupOptionDto {
  key: string;
  labelAr: string;
  labelEn: string;
  labelFr: string;
  sortOrder?: number;
}

export interface UpdateLookupOptionDto {
  labelAr: string;
  labelEn: string;
  labelFr: string;
  isActive: boolean;
  sortOrder: number;
}

export type LookupOptionListResponseDto = ApiListResponse<LookupOptionDto>;
