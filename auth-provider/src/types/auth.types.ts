/** What the form holds. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** The body the auth server expects for `grant_type=password`. */
export interface TokenRequest {
  grant_type: string;
  username: string;
  password: string;
}

/** RFC 6749 §5.1, as the auth server answers it. */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** What reaches the browser — deliberately not the whole token response. */
export interface Session {
  accessToken: string;
  expiresIn: number;
  scope: string;
}
