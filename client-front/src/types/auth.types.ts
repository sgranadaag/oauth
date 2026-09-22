/** RFC 6749 §5.1, plus the OpenID Connect `id_token`. */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** The ID token claims this app reads: who signed in. */
export interface IdTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  email: string;
  exp: number;
  nonce?: string;
}

/**
 * What this app remembers between the redirect out and the callback back in.
 * Kept in an httpOnly cookie, so only this app's server side ever reads it.
 */
export interface AuthorizationTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** What reaches the page — deliberately not the refresh token. */
export interface Session {
  email: string;
  scope: string;
  accessToken: string;
  expiresIn: number;
}
