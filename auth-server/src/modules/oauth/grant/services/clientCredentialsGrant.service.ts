import { Injectable } from '@nestjs/common';
import { ClientEntity } from '@modules/client/client.entity';
import { TokenService } from '@modules/oauth/token/token.service';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import { ScopeService } from '@modules/oauth/scope/scope.service';
import type { TokenRequestParams } from '@modules/oauth/interfaces/tokenEndpoint.interface';
import type { GrantHandler } from '@modules/oauth/grant/interfaces/grant.interface';

@Injectable()
export class ClientCredentialsGrantService implements GrantHandler {
  constructor(
    private readonly scopeService: ScopeService,
    private readonly tokenService: TokenService,
  ) {}

  async handle(
    client: ClientEntity,
    params: TokenRequestParams,
  ): Promise<IssuedTokens> {
    const scope = this.scopeService.narrow(
      client.allowedScopes.join(' '),
      params.scope,
    );

    return this.tokenService.issue({
      clientId: client.id,
      scope,
      accessTokenTtlSeconds: client.accessTokenTtlSeconds ?? undefined,
    });
  }
}
