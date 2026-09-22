import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { ENV } from '@constants/environment.constant';
import type { JwkSet } from '@interfaces/jwks.interface';
import { getPublicJwks } from '@utils/keys.util';
import { buildUrl } from '@utils/url.util';
import type { ClientEntity } from '@modules/client/client.entity';
import { ClientRepository } from '@modules/client/client.repository';
import { AuthorizationService } from '@modules/authorization/authorization.service';
import type { AuthenticatedUser } from '@modules/authorization/interfaces/authorization.interface';
import type { IssuedTokens } from '@modules/token/interfaces/issueToken.interface';
import {
  CODE_RESPONSE_TYPE,
  DEFAULT_AUTH_FRONT_URL,
  OAUTH_ERRORS,
  PKCE_METHOD,
  TOKEN_TYPE,
} from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import { ScopeService } from '@modules/oauth/scope.service';
import type {
  AuthorizeQuery,
  InteractionAcceptResult,
  InteractionDetails,
} from '@modules/oauth/interfaces/authorizeEndpoint.interface';
import type {
  TokenRequestParams,
  TokenResponse,
} from '@modules/oauth/interfaces/tokenEndpoint.interface';
import { GRANT_TYPES } from '@modules/oauth/grantTypes/grantTypes.registry';

@Injectable()
export class OauthService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly clientRepository: ClientRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly scopeService: ScopeService,
    private readonly configService: ConfigService,
  ) {}

  async authorize(query: AuthorizeQuery): Promise<string> {
    const client = await this.clientRepository.findByClientId(query.client_id);
    if (!client) {
      throw new OauthException(OAUTH_ERRORS.INVALID_REQUEST, 'unknown client_id');
    }

    const redirectUri = query.redirect_uri;

    if (!redirectUri || !(client.redirectUris ?? []).includes(redirectUri)) {
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

    const request = await this.authorizationService.createRequest({
      clientId: client.id,
      redirectUri,
      scope,
      state: query.state,
      nonce: query.nonce,
      codeChallenge: query.code_challenge,
    });

    return buildUrl(`${this.authFrontUrl()}/login`, {
      interaction: request.id,
    });
  }

  // What the login page shows: who is asking, and for what.
  async interaction(interactionId: string): Promise<InteractionDetails> {
    const request = await this.activeRequest(interactionId);
    const client = await this.clientRepository.findByClientId(request.clientId);

    return { clientName: client?.name ?? request.clientId, scope: request.scope };
  }

  // The login app says who signed in, and it is believed: how the person
  // proved it (a password today, more factors later) is between the login app
  // and the identity side, and never reaches this module. What the client
  // gets back is a code, through the browser, to its own redirect_uri.
  async acceptInteraction(
    interactionId: string,
    user: AuthenticatedUser,
  ): Promise<InteractionAcceptResult> {
    const request = await this.activeRequest(interactionId);

    const code = await this.authorizationService.issueCode(request, user);
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

  // The keys a verifier needs to check a token offline — a client its ID
  // token, an API an access token. Public halves only.
  jwks(): JwkSet {
    return getPublicJwks();
  }

  // Which grant runs is data, not a switch: the registry is the only place that
  // knows the set. The handler is resolved per request rather than injected,
  // because the set is only known at runtime — Nest caches singletons, so this
  // is a map lookup, not a re-instantiation.
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

    const issued = await this.moduleRef
      .get(registration.service)
      .handle(client, params);

    return this.toTokenResponse(issued);
  }

  private async activeRequest(interactionId: string) {
    const request =
      await this.authorizationService.findActiveRequest(interactionId);
    if (!request) {
      throw new NotFoundException(
        'This sign-in link has expired. Start again from the application.',
      );
    }

    return request;
  }

  private authFrontUrl(): string {
    return (
      this.configService.get<string>(ENV.AUTH_FRONT_URL) ??
      DEFAULT_AUTH_FRONT_URL
    );
  }

  // The one place the wire format is spoken: grants and the token module work
  // in their own vocabulary, and RFC 6749 §5.1 names are applied here.
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
