import type { Type } from '@nestjs/common';
import type { ClientEntity } from '@modules/client/client.entity';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import type { TokenRequestParams } from '@modules/oauth/flows/tokenExchange/interfaces/tokenExchange.interface';

export interface GrantHandler {
  handle(
    client: ClientEntity,
    params: TokenRequestParams,
  ): Promise<IssuedTokens>;
}

export interface GrantTypeRegistration {
  type: string;
  service: Type<GrantHandler>;
}

export interface RefreshTokenGrantParams extends TokenRequestParams {
  refresh_token?: string;
}

export interface AuthorizationCodeGrantParams extends TokenRequestParams {
  code?: string;
  redirect_uri?: string;
}
