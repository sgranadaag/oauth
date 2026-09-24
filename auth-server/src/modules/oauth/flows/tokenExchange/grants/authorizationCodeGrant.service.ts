import { Injectable } from '@nestjs/common';
import { ClientEntity } from '@modules/client/client.entity';
import { AuthorizationService } from '@modules/oauth/authorization/authorization.service';
import { CodeValueEntity } from '@modules/oauth/authorization/entities/codeValue.entity';
import { TokenService } from '@modules/oauth/token/token.service';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import type {
  AuthorizationCodeGrantParams,
  GrantHandler,
} from '@modules/oauth/flows/tokenExchange/interfaces/grant.interface';

@Injectable()
export class AuthorizationCodeGrantService implements GrantHandler {
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly tokenService: TokenService,
  ) {}

  async handle(
    client: ClientEntity,
    params: AuthorizationCodeGrantParams,
  ): Promise<IssuedTokens> {
    const { code, redirect_uri } = params;
    if (!code || !redirect_uri) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'code and redirect_uri are required',
      );
    }

    const redeemedCode = await this.redeem(client, code, redirect_uri);

    return this.tokenService.issue({
      clientId: client.id,
      userId: redeemedCode.userId,
      scope: redeemedCode.scope,
      codeId: redeemedCode.id,
      accessTokenTtlSeconds: client.accessTokenTtlSeconds ?? undefined,
    });
  }

  private async redeem(
    client: ClientEntity,
    code: string,
    redirectUri: string,
  ): Promise<CodeValueEntity> {
    const redeemedCode = await this.authorizationService.redeemCode(code);

    if (!redeemedCode) {
      const replayed = await this.authorizationService.findSpentCode(code);

      if (replayed) {
        await this.tokenService.revokeByCode(replayed.id, client.id);
      }

      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    if (
      redeemedCode.clientId !== client.id ||
      redeemedCode.redirectUri !== redirectUri
    ) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    return redeemedCode;
  }
}
