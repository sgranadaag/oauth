export interface IssueTokenInput {
  clientId: string;

  userId?: string;

  scope: string;

  sessionId?: string;
  sessionExpiresAt?: Date;

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
