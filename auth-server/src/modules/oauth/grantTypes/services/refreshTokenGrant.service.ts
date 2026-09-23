import { Injectable } from '@nestjs/common';
import { isExpired } from '@utils/time.util';
import { ClientEntity } from '@modules/client/client.entity';
import { REFRESH_TOKEN_TYPE } from '@modules/token/token.constants';
import { TokenEntity } from '@modules/token/token.entity';
import { TokenRepository } from '@modules/token/token.repository';
import { TokenService } from '@modules/token/token.service';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { ScopeService } from '@modules/oauth/scope.service';
import type {
  GrantHandler,
  RefreshTokenGrantParams,
} from '@modules/oauth/grantTypes/grantTypes.interfaces';

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
      // The ceiling is what this token already carries, never the client's full
      // set: a refresh must not hand back more than the session had.
      scope: this.scopeService.narrow(token.scope, params.scope),
      sessionId: token.sessionId,
      sessionExpiresAt: token.sessionExpiresAt,
      accessTokenTtlSeconds: client.accessTokenTtlSeconds ?? undefined,
    });
  }

  // Every failure is the same `invalid_grant`, so a caller cannot tell an
  // unknown token from someone else's or from an expired one.
  //
  // Everything checked here is this server's own record. Whether the person
  // is still allowed in is not asked of anyone: the identity side vouched for
  // them at sign-in, and the session's fixed end sends them back to it.
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

    // Reuse of a token already rotated away means the value leaked: the copy
    // in someone else's hands is indistinguishable from this one, so the whole
    // session goes, not just this token.
    if (token.consumedAt) {
      await this.tokenRepository.deleteBySessionId(token.sessionId);
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    // `expiresAt` never goes past the session's end, so this covers both.
    if (isExpired(token.expiresAt)) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    return token;
  }

  private async consume(token: TokenEntity): Promise<void> {
    if (!(await this.tokenRepository.consume(token.id))) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }
  }
}
