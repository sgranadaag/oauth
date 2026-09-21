import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ClientEntity } from '@modules/client/client.entity';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS, TOKEN_TYPE } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/interfaces/tokenEndpoint.interface';
import { GRANT_TYPES } from '@modules/oauth/grantTypes/grantTypes.registry';

@Injectable()
export class OauthService {
  constructor(private readonly moduleRef: ModuleRef) {}

  // Which grant runs is data, not a switch: the registry is the only place that
  // knows the set. The handler is resolved per request rather than injected,
  // because the set is only known at runtime — Nest caches singletons, so this
  // is a map lookup, not a re-instantiation.
  async token(
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

    const registration = GRANT_TYPES.find((grant) => grant.type === grantType);
    if (!registration) {
      throw new OauthException(
        OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE,
        `grant type ${grantType} is not supported`,
      );
    }

    const issued = await this.moduleRef
      .get(registration.service)
      .handle(client, params);

    return this.toTokenResponse(issued);
  }

  // The one place the wire format is spoken: grants and the token module work
  // in their own vocabulary, and RFC 6749 §5.1 names are applied here.
  private toTokenResponse({
    accessToken,
    expiresInSeconds,
    scope,
    refreshToken,
  }: IssuedTokens): TokenResponse {
    return {
      access_token: accessToken,
      expires_in: expiresInSeconds,
      token_type: TOKEN_TYPE,
      scope,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    };
  }
}
