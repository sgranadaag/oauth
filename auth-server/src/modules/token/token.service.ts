import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV } from '@constants/environment.constant';
import { signAccessToken } from '@utils/jwt.util';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TYPE,
} from '@modules/token/token.constants';
import { TokenEntity } from '@modules/token/token.entity';
import { TokenRepository } from '@modules/token/token.repository';
import type {
  IssuedTokens,
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
  }: IssueTokenInput): Promise<IssuedTokens> {
    const accessToken = signAccessToken(
      // No user means the client itself is the subject, as RFC 9068 §5 expects
      // for client_credentials.
      { sub: userId ?? clientId, client_id: clientId, scope },
      {
        issuer: this.issuer(),
        audience: DEFAULT_AUDIENCE,
        expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      },
    );

    const issued: IssuedTokens = {
      accessToken,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
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
      });
    }

    return issued;
  }

  private async issueRefreshToken({
    clientId,
    userId,
    scope,
    sessionId,
  }: {
    clientId: string;
    userId: string;
    scope: string;
    sessionId?: string;
  }): Promise<string> {
    const token = new TokenEntity();
    token.id = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    token.type = REFRESH_TOKEN_TYPE;
    token.clientId = clientId;
    token.userId = userId;
    token.sessionId = sessionId ?? randomUUID();
    token.scope = scope;
    token.expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    token.consumedAt = null;

    await this.tokenRepository.save(token);

    return token.id;
  }

  private issuer(): string {
    return this.configService.get<string>(ENV.OIDC_ISSUER) ?? DEFAULT_ISSUER;
  }
}
