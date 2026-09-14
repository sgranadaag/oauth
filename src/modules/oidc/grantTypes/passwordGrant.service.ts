import { Inject, Injectable } from '@nestjs/common';
import type { KoaContextWithOIDC } from 'oidc-provider';
import { UserRepository } from '@modules/user/user.repository';
import { ClientRepository } from '@modules/client/client.repository';
import { UserEntity } from '@modules/user/user.entity';
import {
  DEFAULT_RESOURCE_INDICATOR,
  OIDC_ERRORS,
  PASSWORD_GRANT_TYPE,
} from '@modules/oidc/oidc.constants';
import type { GrantHandler, OidcErrors } from '@modules/oidc/oidc.interfaces';
import { SIGNING_ALGORITHM } from '@utils/keys.util';
import { verifyPassword } from '@utils/password.util';

type OidcClient = NonNullable<KoaContextWithOIDC['oidc']['client']>;

interface PasswordGrantParams {
  username?: string;
  password?: string;
  scope?: string;
}

interface TokenBuildInput {
  context: KoaContextWithOIDC;
  client: OidcClient;
  user: UserEntity;
  scopes: string[];
  grantId: string;
}

@Injectable()
export class PasswordGrantService implements GrantHandler {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly clientRepository: ClientRepository,
    @Inject(OIDC_ERRORS) private readonly errors: OidcErrors,
  ) { }

  async handle(context: KoaContextWithOIDC): Promise<void> {
    const client = context.oidc.client!;
    const params = context.oidc.params as PasswordGrantParams;

    const user = await this.authenticateUser(client, params);
    const scopes = await this.resolveScopes(user, params.scope);
    const grantId = await this.buildGrant({ context, client, user, scopes });

    const input: TokenBuildInput = { context, client, user, scopes, grantId };
    const accessToken = this.buildAccessToken(input);
    const refreshToken = this.buildRefreshToken(input);

    context.body = {
      access_token: await accessToken.save(),
      refresh_token: await refreshToken.save(),
      expires_in: accessToken.expiration,
      token_type: 'Bearer',
      scope: scopes.join(' '),
    };
  }

  private async authenticateUser(
    client: OidcClient,
    { username, password }: PasswordGrantParams,
  ): Promise<UserEntity> {
    const user = username
      ? await this.userRepository.findByClientAndUsername(
        client.clientId,
        username,
      )
      : null;

    if (
      !user ||
      !password ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      throw new this.errors.InvalidGrant('invalid credentials');
    }

    return user;
  }

  private async resolveScopes(
    user: UserEntity,
    requestedScope?: string,
  ): Promise<string[]> {
    const client = await this.clientRepository.findByClientId(user.clientId);
    const allowedScopes = client!.allowedScopes;

    const requested = requestedScope
      ? requestedScope.split(' ').filter(Boolean)
      : allowedScopes;

    const disallowed = requested.filter(
      (scope) => !allowedScopes.includes(scope),
    );
    if (disallowed.length > 0) {
      throw new this.errors.InvalidScope(
        'scope exceeds what is allowed for this client',
        disallowed.join(' '),
      );
    }

    return requested;
  }

  private async buildGrant({
    context,
    client,
    user,
    scopes,
  }: Omit<TokenBuildInput, 'grantId'>): Promise<string> {
    const grant = new context.oidc.provider.Grant({
      accountId: user.id,
      clientId: client.clientId,
    });

    grant.addOIDCScope(scopes);
    grant.addResourceScope(DEFAULT_RESOURCE_INDICATOR, scopes);
    const grantId = await grant.save();
    context.oidc.entity('Grant', grant);

    return grantId;
  }

  private buildAccessToken({
    context,
    client,
    user,
    scopes,
    grantId,
  }: TokenBuildInput) {
    const grantedScope = scopes.join(' ');
    const resourceServer = new context.oidc.provider.ResourceServer(
      DEFAULT_RESOURCE_INDICATOR,
      {
        scope: grantedScope,
        accessTokenFormat: 'jwt',
        jwt: { sign: { alg: SIGNING_ALGORITHM } },
      },
    );

    const accessToken = new context.oidc.provider.AccessToken({
      accountId: user.id,
      client,
      grantId,
      gty: PASSWORD_GRANT_TYPE,
      scope: grantedScope,
      resourceServer,
    });
    context.oidc.entity('AccessToken', accessToken);

    return accessToken;
  }

  private buildRefreshToken({
    context,
    client,
    user,
    scopes,
    grantId,
  }: TokenBuildInput) {
    const refreshToken = new context.oidc.provider.RefreshToken({
      accountId: user.id,
      client,
      grantId,
      gty: PASSWORD_GRANT_TYPE,
      scope: scopes.join(' '),
      resource: DEFAULT_RESOURCE_INDICATOR,
    });
    context.oidc.entity('RefreshToken', refreshToken);

    return refreshToken;
  }
}
