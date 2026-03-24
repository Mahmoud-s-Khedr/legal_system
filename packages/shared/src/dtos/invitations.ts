import type { ApiListResponse } from "../types/common";

export interface InvitationDto {
  id: string;
  roleId: string;
  roleName: string;
  email: string;
  token: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface CreateInvitationDto {
  email: string;
  roleId: string;
}

export type InvitationListResponseDto = ApiListResponse<InvitationDto>;
