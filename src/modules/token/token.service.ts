import { Inject, Injectable } from '@nestjs/common';
import { ClientRepository } from '../client/client.repository';
import { UserEntity } from '../user/user.entity';
import {
  DEFAULT_RESOURCE_INDICATOR,
  OIDC_ERRORS,
} from '../oidc/oidc.constants';
import type { OidcErrors } from '../oidc/interfaces/errors.interface';
import type {
  IssueTokensInput,
  TokenBuildInput,
  TokenResponse,
} from './interfaces/issueTokens.interface';
import { SIGNING_ALGORITHM } from '@utils/keys.util';

@Injectable()
export class TokenService {
  constructor(
    private readonly clientRepository: ClientRepository,
    @Inject(OIDC_ERRORS) private readonly errors: OidcErrors,
  ) {}

  async issue({
    context,
    client,
    user,
    grantType,
    requestedScope,
  }: IssueTokensInput): Promise<TokenResponse> {
    const scopes = await this.resolveScopes(user, requestedScope);
    const grantId = await this.buildGrant({
      context,
      client,
      user,
      grantType,
      scopes,
    });

    const input: TokenBuildInput = {
      context,
      client,
      user,
      grantType,
      scopes,
      grantId,
    };
    const accessToken = this.buildAccessToken(input);
    const refreshToken = this.buildRefreshToken(input);

    return {
      access_token: await accessToken.save(),
      refresh_token: await refreshToken.save(),
      expires_in: accessToken.expiration,
      token_type: 'Bearer',
      scope: scopes.join(' '),
    };
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
    grantType,
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
      gty: grantType,
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
    grantType,
    scopes,
    grantId,
  }: TokenBuildInput) {
    const refreshToken = new context.oidc.provider.RefreshToken({
      accountId: user.id,
      client,
      grantId,
      gty: grantType,
      scope: scopes.join(' '),
      resource: DEFAULT_RESOURCE_INDICATOR,
    });
    context.oidc.entity('RefreshToken', refreshToken);

    return refreshToken;
  }
}
