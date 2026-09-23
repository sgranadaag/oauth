import { Injectable } from '@nestjs/common';
import { isExpired } from '@common/utils/date.util';
import { ClientEntity } from '@modules/client/client.entity';
import { REFRESH_TOKEN_TYPE } from '@modules/oauth/token/token.constants';
import { TokenEntity } from '@modules/oauth/token/token.entity';
import { TokenRepository } from '@modules/oauth/token/token.repository';
import { TokenService } from '@modules/oauth/token/token.service';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { ScopeService } from '@modules/oauth/scope/scope.service';
import type {
  GrantHandler,
  RefreshTokenGrantParams,
} from '@modules/oauth/grant/interfaces/grant.interface';

@Injectable()
export class RefreshTokenGrantService implements GrantHandler {
  constructor(
    private readonly tokenRepository: TokenRepository,
    private readonly scopeService: ScopeService,
    private readonly tokenService: TokenService,
  ) {}

  async handle(
    client: ClientEntity,
    params: RefreshTokenGrantParams,
  ): Promise<IssuedTokens> {
    const presented = params.refresh_token;
    if (!presented) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'refresh_token is required',
      );
    }

    const token = await this.validate(client.id, presented);
    await this.consume(token);

    return this.tokenService.issue({
      clientId: client.id,
      userId: token.userId,

      scope: this.scopeService.narrow(token.scope, params.scope),
      sessionId: token.sessionId,
      sessionExpiresAt: token.sessionExpiresAt,
      accessTokenTtlSeconds: client.accessTokenTtlSeconds ?? undefined,
    });
  }

  private async validate(
    clientId: string,
    presented: string,
  ): Promise<TokenEntity> {
    const token = await this.tokenRepository.findById(presented);

    if (
      !token ||
      token.type !== REFRESH_TOKEN_TYPE ||
      token.clientId !== clientId
    ) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    if (token.consumedAt) {
      await this.tokenRepository.deleteBySessionId(token.sessionId);
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    if (isExpired(token.expiresAt)) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    return token;
  }

  private async consume(token: TokenEntity): Promise<void> {
    const wasConsumed = await this.tokenRepository.consume(token.id);

    if (!wasConsumed) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }
  }
}
