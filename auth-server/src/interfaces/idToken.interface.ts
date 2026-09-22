import type { JwtPayload } from 'jsonwebtoken';

// OpenID Connect Core §2: the claims an ID token carries about the person.
// `iss`, `aud`, `iat` and `exp` are stamped from the signing options.
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
