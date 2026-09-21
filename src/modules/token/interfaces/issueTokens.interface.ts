import type { KoaContextWithOIDC } from 'oidc-provider';
import type { OidcClient } from '@interfaces/oidcClient.interface';
import type { UserEntity } from '../../user/user.entity';

export interface IssueTokensInput {
  context: KoaContextWithOIDC;
  client: OidcClient;
  user: UserEntity;
  grantType: string;
  requestedScope?: string;
}

export interface TokenBuildInput {
  context: KoaContextWithOIDC;
  client: OidcClient;
  user: UserEntity;
  grantType: string;
  scopes: string[];
  grantId: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}
