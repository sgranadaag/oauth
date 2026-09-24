import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@core/config/env.config';
import { signAccessToken } from '@modules/oauth/token/utils/jwt.util';
import { createRandomValue } from '@common/utils/crypto.util';
import { secondsFromNow } from '@common/utils/date.util';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TYPE,
  SESSION_TTL_SECONDS,
} from '@modules/oauth/token/token.constants';
import { TokenEntity } from '@modules/oauth/token/token.entity';
import { TokenRepository } from '@modules/oauth/token/token.repository';
import type {
  IssuedTokens,
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
    codeId,
  }: IssueTokenInput): Promise<IssuedTokens> {
    const accessTokenTtl = accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;

    const accessToken = signAccessToken(
      { sub: userId ?? clientId, 
        client_id: clientId, 
        scope 
      },
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
        codeId,
      });
    }

    return issued;
  }

  async revokeSession(tokenId: string, clientId: string): Promise<void> {
    const token = await this.tokenRepository.find(tokenId);
    if (!token || token.clientId !== clientId) return;

    await this.tokenRepository.removeBySessionId(token.sessionId);
  }

  async revokeByCode(codeId: string, clientId: string): Promise<void> {
    const token = await this.tokenRepository.findByCodeId(codeId);
    if (!token || token.clientId !== clientId) return;

    await this.tokenRepository.removeBySessionId(token.sessionId);
  }

  removeAll(): Promise<number> {
    return this.tokenRepository.removeAll();
  }

  private async issueRefreshToken({
    clientId,
    userId,
    scope,
    sessionId,
    sessionExpiresAt,
    codeId,
  }: {
    clientId: string;
    userId: string;
    scope: string;
    sessionId?: string;
    sessionExpiresAt?: Date;
    codeId?: string;
  }): Promise<string> {
    const sessionEnd = sessionExpiresAt ?? secondsFromNow(SESSION_TTL_SECONDS);

    const token = new TokenEntity();
    token.id = createRandomValue(REFRESH_TOKEN_BYTES);
    token.type = REFRESH_TOKEN_TYPE;
    token.clientId = clientId;
    token.userId = userId;
    token.sessionId = sessionId ?? randomUUID();
    token.sessionExpiresAt = sessionEnd;
    token.codeId = codeId ?? null;
    token.scope = scope;

    token.expiresAt = new Date(
      Math.min(
        secondsFromNow(REFRESH_TOKEN_TTL_SECONDS).getTime(),
        sessionEnd.getTime(),
      ),
    );
    token.consumedAt = null;

    await this.tokenRepository.create(token);

    return token.id;
  }

  private issuer(): string {
    return this.configService.get<string>(ENV.OIDC_ISSUER) ?? DEFAULT_ISSUER;
  }
}
