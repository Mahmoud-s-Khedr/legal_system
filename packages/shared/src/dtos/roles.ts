import type { ApiListResponse } from "../types/common";

export interface RoleDto {
  id: string;
  firmId: string | null;
  key: string;
  name: string;
  scope: string;
  permissions: string[];
}

export interface CreateRoleDto {
  key: string;
  name: string;
}

export interface UpdateRoleDto {
  name: string;
}

export interface SetRolePermissionsDto {
  permissionKeys: string[];
}

export type RoleListResponseDto = ApiListResponse<RoleDto>;
