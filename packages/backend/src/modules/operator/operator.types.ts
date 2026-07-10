export interface OperatorSessionUser {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "SUSPENDED";
}

export interface OperatorAccessTokenClaims {
  sub: string;
  email: string;
  displayName: string;
}

export interface OperatorLoginDto {
  email: string;
  password: string;
}
