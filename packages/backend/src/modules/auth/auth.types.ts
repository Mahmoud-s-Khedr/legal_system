import type {
  AcceptInviteDto,
  AuthResponseDto,
  LoginDto,
  RegisterDto,
  SetupDto,
  SessionUser
} from "@elms/shared";

export interface AuthService {
  register?(payload: RegisterDto): Promise<AuthResponseDto>;
  setup?(payload: SetupDto): Promise<AuthResponseDto>;
  acceptInvite?(payload: AcceptInviteDto): Promise<AuthResponseDto>;
  login(payload: LoginDto): Promise<AuthResponseDto>;
  refresh?(requestCookies: Record<string, string | undefined>): Promise<AuthResponseDto>;
  logout(requestCookies: Record<string, string | undefined>): Promise<void>;
  getResponseCookies?(session: AuthResponseDto): Record<string, string>;
  clearResponseCookies(): string[];
}

export interface SessionPayload {
  user: SessionUser;
}
