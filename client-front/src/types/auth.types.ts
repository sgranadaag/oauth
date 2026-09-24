/** RFC 6749 §5.1. No `id_token`: this is plain OAuth 2.0, not OIDC. */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** The JWT header this app reads before trusting anything below it. */
export interface JwtHeader {
  alg: string;
  kid?: string;
}

/** RFC 9068: the claims this server puts in an access token. */
export interface AccessTokenClaims {
  iss: string;
  sub: string;
  client_id: string;
  scope: string;
  exp: number;
}

/**
 * What this app remembers between the redirect out and the callback back in.
 *
 * With no PKCE, `state` is the whole of it — and the whole of this client's
 * protection on the front channel (RFC 6749 §10.12).
 */
export interface AuthorizationTransaction {
  state: string;
}

/** What this app keeps after signing someone in, in `sessionStorage`. */
export interface Session {
  scope: string;
  accessToken: string;
  refreshToken: string;
  subject: string;
  expiresAt: number;
}
