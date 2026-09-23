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

/**
 * What this app keeps after signing someone in, in an httpOnly cookie.
 *
 * It holds the refresh token so the session can be renewed without sending
 * the person back to the provider. The cookie is `httpOnly`, so no script in
 * the page can read it — but this app then *renders* both tokens, which is
 * illustration, not something a real client would do.
 */
export interface Session {
  email: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  // Absolute, in epoch milliseconds, so the page can show when the access
  // token dies and how that moves after a renewal.
  expiresAt: number;
}
