import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ClientEntity } from '@modules/client/client.entity';
import { OAUTH_ERRORS, TOKEN_TYPE } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { DEFAULT_GRANT_TYPES } from '@modules/client/client.constants';
import { GRANT_TYPES } from '@modules/oauth/flows/tokenExchange/grant.registry';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/flows/tokenExchange/interfaces/tokenExchange.interface';

@Injectable()
export class TokenExchangeService {
  constructor(private readonly moduleRef: ModuleRef) {}

  async exchange(
    client: ClientEntity,
    params: TokenRequestParams,
  ): Promise<TokenResponse> {
    const grantType = params.grant_type;
    if (!grantType) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'grant_type is required',
      );
    }

    const grantTypes = client.grantTypes ?? DEFAULT_GRANT_TYPES;
    if (!grantTypes.includes(grantType)) {
      throw new OauthException(
        OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
        `this client is not registered for ${grantType}`,
      );
    }

    const registration = GRANT_TYPES.find((grant) => grant.type === grantType);
    if (!registration) {
      throw new OauthException(
        OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE,
        `grant type ${grantType} is not supported`,
      );
    }

    const handler = this.moduleRef.get(registration.service, { strict: false });
    const issued = await handler.handle(client, params);

    return this.toResponse(issued);
  }

  private toResponse({
    accessToken,
    expiresInSeconds,
    scope,
    refreshToken,
  }: IssuedTokens): TokenResponse {
    const refreshTokenField = refreshToken
      ? { refresh_token: refreshToken }
      : {};

    return {
      access_token: accessToken,
      expires_in: expiresInSeconds,
      token_type: TOKEN_TYPE,
      scope,
      ...refreshTokenField,
    };
  }
}
