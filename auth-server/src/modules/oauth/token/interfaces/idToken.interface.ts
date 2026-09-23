import type { JwtPayload } from 'jsonwebtoken';

export interface IdTokenClaims extends JwtPayload {
  sub: string;
  email: string;
  nonce?: string;
}

export interface SignIdTokenOptions {
  issuer: string;
  clientId: string;
  expiresInSeconds: number;
}
