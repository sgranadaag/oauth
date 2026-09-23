import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import type { JwkSet } from '@modules/oauth/token/interfaces/jwks.interface';
import { getPublicJwks } from '@modules/oauth/token/utils/keys.util';
import { buildUrl } from '@common/utils/http.util';
import type { ClientEntity } from '@modules/client/client.entity';
import { ClientRepository } from '@modules/client/client.repository';
import { DEFAULT_GRANT_TYPES } from '@modules/client/client.constants';
import { CodeService } from '@modules/oauth/code/code.service';
import { TokenService } from '@modules/oauth/token/token.service';
import type { IssuedTokens } from '@modules/oauth/token/interfaces/issueToken.interface';
import {
  CODE_RESPONSE_TYPE,
  DEFAULT_IDENTITY_PROVIDER,
  IDENTITY_PROVIDERS,
  OAUTH_ERRORS,
  PKCE_METHOD,
  TOKEN_TYPE,
} from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { ScopeService } from '@modules/oauth/scope/scope.service';
import type {
  AuthenticatedUser,
  AuthorizeQuery,
  InteractionAcceptResult,
  InteractionDetails,
} from '@modules/oauth/interfaces/authorizeEndpoint.interface';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/interfaces/tokenEndpoint.interface';
import type { RevokeRequestParams } from '@modules/oauth/interfaces/revokeEndpoint.interface';
import { GRANT_TYPES } from '@modules/oauth/grant/grant.registry';
import { AUTHORIZATION_CODE_GRANT_TYPE } from '@modules/oauth/grant/grant.constants';

@Injectable()
export class OauthService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly clientRepository: ClientRepository,
    private readonly codeService: CodeService,
    private readonly scopeService: ScopeService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async authorize(query: AuthorizeQuery): Promise<string> {
    const client = await this.clientRepository.findByClientId(query.client_id);
    if (!client) {
      throw new OauthException(OAUTH_ERRORS.INVALID_REQUEST, 'unknown client_id');
    }

    const redirectUri = query.redirect_uri;
    const registeredUris = client.redirectUris ?? [];

    if (!redirectUri || !registeredUris.includes(redirectUri)) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'redirect_uri is not registered for this client',
      );
    }

    const backToClient = (error: string, description: string): string =>
      buildUrl(redirectUri, {
        error,
        error_description: description,
        state: query.state,
      });

    if (query.response_type !== CODE_RESPONSE_TYPE) {
      return backToClient(
        OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
        'only response_type=code is supported',
      );
    }

    if (!this.allowsGrant(client, AUTHORIZATION_CODE_GRANT_TYPE)) {
      return backToClient(
        OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
        'this client is not registered for authorization_code',
      );
    }

    const loginUrl = this.loginUrl(query.idp ?? DEFAULT_IDENTITY_PROVIDER);
    if (!loginUrl) {
      return backToClient(
        OAUTH_ERRORS.INVALID_REQUEST,
        `unknown identity provider: ${query.idp}`,
      );
    }

    if (!query.code_challenge || query.code_challenge_method !== PKCE_METHOD) {
      return backToClient(
        OAUTH_ERRORS.INVALID_REQUEST,
        'PKCE with code_challenge_method=S256 is required',
      );
    }

    console.log(client.allowedScopes.join(' '), query.scope)
    let scope: string;
    try {
      scope = this.scopeService.narrow(client.allowedScopes.join(' '), query.scope);
    } catch {
      return backToClient(
        OAUTH_ERRORS.INVALID_SCOPE,
        'scope exceeds what this client may request',
      );
    }

    const request = await this.codeService.createRequest({
      clientId: client.id,
      redirectUri,
      scope,
      state: query.state,
      nonce: query.nonce,
      codeChallenge: query.code_challenge,
    });

    return buildUrl(loginUrl, { interaction: request.id });
  }

  async interaction(interactionId: string): Promise<InteractionDetails> {
    const request = await this.activeRequest(interactionId);
    const client = await this.clientRepository.findByClientId(request.clientId);

    return { clientName: client?.name ?? request.clientId, scope: request.scope };
  }

  async acceptInteraction(
    interactionId: string,
    user: AuthenticatedUser,
  ): Promise<InteractionAcceptResult> {
    const request = await this.activeRequest(interactionId);

    const code = await this.codeService.issueCode(request, user);
    if (!code) {
      throw new NotFoundException('This sign-in has already been completed');
    }

    return {
      redirectTo: buildUrl(request.redirectUri, {
        code,
        state: request.state ?? undefined,
      }),
    };
  }

  async revoke(
    client: ClientEntity,
    params: RevokeRequestParams,
  ): Promise<void> {
    if (!params.token) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'token is required',
      );
    }

    await this.tokenService.revokeSession(params.token, client.id);
  }

  jwks(): JwkSet {
    return getPublicJwks();
  }

  async token(
    client: ClientEntity,
    params: TokenRequestParams,
  ): Promise<TokenResponse> {
    const grantType = params.grant_type;
    if (!grantType) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'grant_type is required',
      );
    }

    const registration = GRANT_TYPES.find((grant) => grant.type === grantType);
    if (!registration) {
      throw new OauthException(
        OAUTH_ERRORS.UNSUPPORTED_GRANT_TYPE,
        `grant type ${grantType} is not supported`,
      );
    }

    const handler = this.moduleRef.get(registration.service, { strict: false });
    const issued = await handler.handle(client, params);

    return this.toTokenResponse(issued);
  }

  private allowsGrant(client: ClientEntity, grantType: string): boolean {
    return (client.grantTypes ?? DEFAULT_GRANT_TYPES).includes(grantType);
  }

  private loginUrl(identityProvider: string): string | undefined {
    const provider =
      IDENTITY_PROVIDERS[identityProvider as keyof typeof IDENTITY_PROVIDERS];
    if (!provider) return undefined;

    return (
      this.configService.get<string>(provider.env) ?? provider.defaultUrl
    );
  }

  private async activeRequest(interactionId: string) {
    const request =
      await this.codeService.findActiveRequest(interactionId);
    if (!request) {
      throw new NotFoundException(
        'This sign-in link has expired. Start again from the application.',
      );
    }

    return request;
  }

  private toTokenResponse({
    accessToken,
    expiresInSeconds,
    scope,
    refreshToken,
    idToken,
  }: IssuedTokens): TokenResponse {
    const refreshTokenField = refreshToken ? { refresh_token: refreshToken } : {};
    const idTokenField = idToken ? { id_token: idToken } : {};

    return {
      access_token: accessToken,
      expires_in: expiresInSeconds,
      token_type: TOKEN_TYPE,
      scope,
      ...refreshTokenField,
      ...idTokenField,
    };
  }
}
