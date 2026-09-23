import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@core/config/env.config';
import { signAccessToken, signIdToken } from '@modules/oauth/token/utils/jwt.util';
import { createRandomValue } from '@common/utils/crypto.util';
import { secondsFromNow } from '@common/utils/date.util';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  ID_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TYPE,
  SESSION_TTL_SECONDS,
} from '@modules/oauth/token/token.constants';
import { TokenEntity } from '@modules/oauth/token/token.entity';
import { TokenRepository } from '@modules/oauth/token/token.repository';
import type {
  IssuedTokens,
  IssueIdTokenInput,
  IssueTokenInput,
} from '@modules/oauth/token/interfaces/issueToken.interface';

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

  async revokeSession(tokenId: string, clientId: string): Promise<void> {
    const token = await this.tokenRepository.findById(tokenId);
    if (!token || token.clientId !== clientId) return;

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
