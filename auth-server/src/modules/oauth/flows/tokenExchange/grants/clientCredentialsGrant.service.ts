import { Injectable } from '@nestjs/common';
import { ClientEntity } from '@modules/client/client.entity';
import { TokenService } from '@modules/oauth/token/token.service';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import type { TokenRequestParams } from '@modules/oauth/flows/tokenExchange/interfaces/tokenExchange.interface';
import type { GrantHandler } from '@modules/oauth/flows/tokenExchange/interfaces/grant.interface';

@Injectable()
export class ClientCredentialsGrantService implements GrantHandler {
  constructor(private readonly tokenService: TokenService) {}

  async handle(
    client: ClientEntity,
    params: TokenRequestParams,
  ): Promise<IssuedTokens> {
    const allowedScopes = client.allowedScopes;
    const requestedScopes = params.scope?.split(' ').filter(Boolean) ?? allowedScopes;
    const disallowedScopes = requestedScopes.filter(
      (requested) => !allowedScopes.includes(requested),
    );

    if (disallowedScopes.length > 0) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_SCOPE,
        `scope exceeds what was granted: ${disallowedScopes.join(' ')}`,
      );
    }

    const scope = requestedScopes.join(' ');

    return this.tokenService.issue({
      clientId: client.id,
      scope,
      accessTokenTtlSeconds: client.accessTokenTtlSeconds ?? undefined,
    });
  }
}
