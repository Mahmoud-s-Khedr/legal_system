import { EditionKey, Language } from "../enums/index";
import type { AppSession } from "../types/auth";

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto extends LoginDto {
  firmName: string;
  fullName: string;
}

export interface SetupDto extends LoginDto {
  firmName: string;
  fullName: string;
  editionKey: EditionKey;
}

export interface AcceptInviteDto {
  token: string;
  fullName: string;
  password: string;
}

export interface AuthResponseDto {
  session: AppSession;
  localSessionToken?: string;
}

export interface MeResponseDto {
  session: AppSession;
}

export interface LogoutResponseDto {
  success: true;
}

export interface AuthModeResponseDto {
  mode: string;
}

export interface LanguageOption {
  value: Language;
  label: string;
}
