import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@constants/environment.constant';
import { signAccessToken, signIdToken } from '@utils/jwt.util';
import { createRandomValue } from '@utils/random.util';
import { secondsFromNow } from '@utils/time.util';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  ID_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TYPE,
  SESSION_TTL_SECONDS,
} from '@modules/token/token.constants';
import { TokenEntity } from '@modules/token/token.entity';
import { TokenRepository } from '@modules/token/token.repository';
import type {
  IssuedTokens,
  IssueIdTokenInput,
  IssueTokenInput,
} from '@modules/token/interfaces/issueToken.interface';

// The single place a token is minted. It knows nothing about grants, clients or
// which scopes a caller may ask for: it is told who the token is for and what it
// carries, and it mints, stores and rotates.
@Injectable()
export class TokenService {
  constructor(
    private readonly tokenRepository: TokenRepository,
    private readonly configService: ConfigService,
  ) {}

  async issue({
    clientId,
    userId,
    scope,
    sessionId,
    sessionExpiresAt,
    accessTokenTtlSeconds,
  }: IssueTokenInput): Promise<IssuedTokens> {
    const accessTokenTtl = accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;

    const accessToken = signAccessToken(
      // No user means the client itself is the subject, as RFC 9068 §5 expects
      // for client_credentials.
      { sub: userId ?? clientId, client_id: clientId, scope },
      {
        issuer: this.issuer(),
        audience: DEFAULT_AUDIENCE,
        expiresInSeconds: accessTokenTtl,
      },
    );

    const issued: IssuedTokens = {
      accessToken,
      expiresInSeconds: accessTokenTtl,
      scope,
    };

    // A refresh token is what lets a session outlive an access token, so it
    // only exists where there is a user to come back for.
    if (userId) {
      issued.refreshToken = await this.issueRefreshToken({
        clientId,
        userId,
        scope,
        sessionId,
        sessionExpiresAt,
      });
    }

    return issued;
  }

  // A statement about who signed in, addressed to the client. The caller
  // decides whether one is owed (the `openid` scope is an OpenID Connect rule,
  // not this module's); this only mints it.
  issueIdToken({ clientId, userId, email, nonce }: IssueIdTokenInput): string {
    const nonceClaim = nonce ? { nonce } : {};

    return signIdToken(
      { sub: userId, email, ...nonceClaim },
      {
        issuer: this.issuer(),
        clientId,
        expiresInSeconds: ID_TOKEN_TTL_SECONDS,
      },
    );
  }

  /**
   * Ends the session a refresh token belongs to, by deleting every token in
   * it — the one presented and the ones it was rotated from.
   *
   * A token this client did not get is left alone: nothing is revealed either
   * way, since the caller is told nothing about what was found.
   */
  async revokeSession(tokenId: string, clientId: string): Promise<void> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token || token.clientId !== clientId) {
      return;
    }

    await this.tokenRepository.deleteBySessionId(token.sessionId);
  }

  private async issueRefreshToken({
    clientId,
    userId,
    scope,
    sessionId,
    sessionExpiresAt,
  }: {
    clientId: string;
    userId: string;
    scope: string;
    sessionId?: string;
    sessionExpiresAt?: Date;
  }): Promise<string> {
    const sessionEnd = sessionExpiresAt ?? secondsFromNow(SESSION_TTL_SECONDS);

    const token = new TokenEntity();
    token.id = createRandomValue(REFRESH_TOKEN_BYTES);
    token.type = REFRESH_TOKEN_TYPE;
    token.clientId = clientId;
    token.userId = userId;
    token.sessionId = sessionId ?? randomUUID();
    token.sessionExpiresAt = sessionEnd;
    token.scope = scope;
    // Rotation renews the token, never the session: no token outlives the
    // session's fixed end.
    token.expiresAt = new Date(
      Math.min(
        secondsFromNow(REFRESH_TOKEN_TTL_SECONDS).getTime(),
        sessionEnd.getTime(),
      ),
    );
    token.consumedAt = null;

    await this.tokenRepository.save(token);

    return token.id;
  }

  private issuer(): string {
    return this.configService.get<string>(ENV.OIDC_ISSUER) ?? DEFAULT_ISSUER;
  }
}
