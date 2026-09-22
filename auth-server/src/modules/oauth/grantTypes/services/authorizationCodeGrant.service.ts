import { Injectable } from '@nestjs/common';
import { computeCodeChallenge } from '@utils/pkce.util';
import { constantTimeEquals } from '@utils/string.util';
import { ClientEntity } from '@modules/client/client.entity';
import { AuthorizationService } from '@modules/authorization/authorization.service';
import { AuthorizationCodeEntity } from '@modules/authorization/authorizationCode.entity';
import { TokenService } from '@modules/token/token.service';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import { OAUTH_ERRORS, OPENID_SCOPE } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import type {
  AuthorizationCodeGrantParams,
  GrantHandler,
} from '@modules/oauth/grantTypes/grantTypes.interfaces';

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
    const { code, redirect_uri, code_verifier } = params;
    if (!code || !redirect_uri || !code_verifier) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'code, redirect_uri and code_verifier are required',
      );
    }

    const authorization = await this.redeem(client, code, redirect_uri, code_verifier);

    const issued = await this.tokenService.issue({
      clientId: client.id,
      userId: authorization.userId,
      scope: authorization.scope,
    });

    // OpenID Connect Core §3.1.3.3: an ID token is owed only when the person
    // was asked about `openid`. Without it this is plain OAuth, and the client
    // gets access to an API, not a statement about who signed in.
    if (!authorization.scope.split(' ').includes(OPENID_SCOPE)) {
      return issued;
    }

    return {
      ...issued,
      idToken: this.tokenService.issueIdToken({
        clientId: client.id,
        userId: authorization.userId,
        email: authorization.email,
        nonce: authorization.nonce ?? undefined,
      }),
    };
  }

  // Every check that fails is the same `invalid_grant`: unknown, already used
  // or expired code, a code issued to another client, a redirect_uri that is
  // not the one the flow started with, a verifier that does not answer the
  // challenge. The code is already spent by the time any of them run.
  private async redeem(
    client: ClientEntity,
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<AuthorizationCodeEntity> {
    const authorization = await this.authorizationService.redeemCode(code);

    const isValid =
      !!authorization &&
      authorization.clientId === client.id &&
      // RFC 6749 §4.1.3: the same redirect_uri as the authorization request,
      // so a code leaked on the way back cannot be replayed from elsewhere.
      authorization.redirectUri === redirectUri &&
      // RFC 7636 §4.6: only the client that sent the challenge knows the
      // verifier behind it.
      constantTimeEquals(
        computeCodeChallenge(codeVerifier),
        authorization.codeChallenge,
      );

    if (!isValid) {
      throw new OauthException(OAUTH_ERRORS.INVALID_GRANT, 'invalid grant');
    }

    return authorization;
  }
}
