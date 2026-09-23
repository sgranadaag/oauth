import { Injectable } from '@nestjs/common';
import { ClientEntity } from '@modules/client/client.entity';
import { TokenService } from '@modules/token/token.service';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import { ScopeService } from '@modules/oauth/scope.service';
import type { TokenRequestParams } from '@modules/oauth/interfaces/tokenEndpoint.interface';
import type { GrantHandler } from '@modules/oauth/grantTypes/grantTypes.interfaces';

// The shortest grant there is: the client authenticated itself with its secret
// at the guard, and there is no user to establish — so there is nothing left to
// prove here.
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
