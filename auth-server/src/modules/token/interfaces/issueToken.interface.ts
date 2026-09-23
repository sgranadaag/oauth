export interface IssueTokenInput {
  clientId: string;
  // Absent when the client itself is the subject: no user means no refresh
  // token either, since there is no session to come back to.
  userId?: string;
  // Already resolved by the caller — this module mints what it is told to.
  scope: string;
  // Both set when rotating, to keep the new token in the session it replaces
  // and inside that session's fixed end.
  sessionId?: string;
  sessionExpiresAt?: Date;
  // The client's own access token lifetime, when its registration sets one.
  // Absent means this server's default.
  accessTokenTtlSeconds?: number;
}

export interface IssuedTokens {
  accessToken: string;
  expiresInSeconds: number;
  scope: string;
  refreshToken?: string;
  idToken?: string;
}

export interface IssueIdTokenInput {
  clientId: string;
  userId: string;
  email: string;
  nonce?: string;
}
