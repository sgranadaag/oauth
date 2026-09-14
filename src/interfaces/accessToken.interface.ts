import type { JwtPayload } from 'jsonwebtoken';

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  client_id: string;
  scope?: string;
}

export interface SignAccessTokenOptions {
  issuer: string;
  audience: string;
  expiresInSeconds: number;
}

export interface VerifyAccessTokenOptions {
  issuer: string;
  audience: string;
}
