export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface JwtHeader {
  alg: string;
  kid?: string;
}

export interface AccessTokenClaims {
  iss: string;
  sub: string;
  client_id: string;
  scope: string;
  exp: number;
}

export interface AuthorizationTransaction {
  state: string;
}

export interface Session {
  scope: string;
  accessToken: string;
  refreshToken: string;
  subject: string;
  expiresAt: number;
}
