import { Injectable } from '@nestjs/common';
import { constantTimeEquals, sha256Base64Url } from '@common/utils/crypto.util';
import { ClientEntity } from '@modules/client/client.entity';
import { CodeService } from '@modules/oauth/code/code.service';
import { CodeEntity } from '@modules/oauth/code/entities/code.entity';
import { TokenService } from '@modules/oauth/token/token.service';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS, OPENID_SCOPE } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import type {
  AuthorizationCodeGrantParams,
  GrantHandler,
} from '@modules/oauth/grant/interfaces/grant.interface';

@Injectable()
export class AuthorizationCodeGrantService implements GrantHandler {
  constructor(
    private readonly codeService: CodeService,
    private readonly tokenService: TokenService,
  ) {}

  async handle(
    client: ClientEntity,
    params: AuthorizationCodeGrantParams,
  ): Promise<IssuedTokens> {
    const { code, redirect_uri, code_verifier } = params;
    if (!code || !redirect_uri || !code_verifier) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'code, redirect_uri and code_verifier are required',
      );
    }

    const redeemedCode = await this.redeem(client, code, redirect_uri, code_verifier);

    const issued = await this.tokenService.issue({
      clientId: client.id,
      userId: redeemedCode.userId,
      scope: redeemedCode.scope,
      accessTokenTtlSeconds: client.accessTokenTtlSeconds ?? undefined,
    });

    if (!redeemedCode.scope.split(' ').includes(OPENID_SCOPE)) {
      return issued;
    }

    return {
      ...issued,
      idToken: this.tokenService.issueIdToken({
        clientId: client.id,
        userId: redeemedCode.userId,
        email: redeemedCode.email,
        nonce: redeemedCode.nonce ?? undefined,
      }),
    };
  }

  private async redeem(
    client: ClientEntity,
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<CodeEntity> {
    const redeemedCode = await this.codeService.redeemCode(code);

    const isValid =
      !!redeemedCode &&
      redeemedCode.clientId === client.id &&

      redeemedCode.redirectUri === redirectUri &&

      constantTimeEquals(
        sha256Base64Url(codeVerifier),
        redeemedCode.codeChallenge,
      );

    if (!isValid) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    return redeemedCode;
  }
}
