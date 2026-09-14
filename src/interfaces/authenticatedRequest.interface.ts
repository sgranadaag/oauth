import type { Request } from 'express';
import type { AccessTokenClaims } from '@interfaces/accessToken.interface';

export interface BasicTokenRequest extends Request {
  clientId: string;
}

export interface BearerTokenRequest extends Request {
  token: AccessTokenClaims;
}
