export interface IssueTokenInput {
  clientId: string;
  // Absent when the client itself is the subject: no user means no refresh
  // token either, since there is no session to come back to.
  userId?: string;
  // Already resolved by the caller — this module mints what it is told to.
  scope: string;
  // Set when rotating, to keep the new token in the session it replaces.
  sessionId?: string;
}

export interface IssuedTokens {
  accessToken: string;
  expiresInSeconds: number;
  scope: string;
  refreshToken?: string;
}
