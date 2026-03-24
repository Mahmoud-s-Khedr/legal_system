import type { ApiListResponse } from "../types/common";

export interface UserDto {
  id: string;
  firmId: string;
  roleId: string;
  roleKey: string;
  email: string;
  fullName: string;
  preferredLanguage: string;
  status: string;
  permissions: string[];
  createdAt: string;
}

export interface CreateLocalUserDto {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  preferredLanguage?: string;
}

export interface UpdateUserDto {
  fullName: string;
  email: string;
  roleId: string;
  preferredLanguage?: string;
  status?: string;
}

export interface ChangeOwnPasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface AdminSetPasswordDto {
  newPassword: string;
}

export interface UpdateUserStatusDto {
  status: string;
}

export type UserListResponseDto = ApiListResponse<UserDto>;
