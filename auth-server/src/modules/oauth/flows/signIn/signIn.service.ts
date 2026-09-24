import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildUrl } from '@common/utils/http.util';
import { ENV } from '@core/config/env.config';
import { ClientRepository } from '@modules/client/client.repository';
import { UserService } from '@modules/user/user.service';
import {
  DEFAULT_LOGIN_APP_URL,
  OAUTH_ERRORS,
} from '@modules/oauth/oauth.constants';
import { DEFAULT_GRANT_TYPES } from '@modules/client/client.constants';
import { AUTHORIZATION_CODE_GRANT_TYPE } from '@modules/oauth/flows/tokenExchange/grant.constants';
import { CODE_RESPONSE_TYPE } from '@modules/oauth/oauth.constants';
import { AuthorizationService } from '@modules/oauth/authorization/authorization.service';
import { SessionService } from '@modules/oauth/session/session.service';
import { OauthException } from '@modules/oauth/oauth.exception';
import type { RequestEntity } from '@modules/oauth/authorization/entities/request.entity';
import type {
  AuthorizeQuery,
  Credentials,
  InteractionDetails,
  SignInResult,
} from '@modules/oauth/flows/signIn/interfaces/signIn.interface';

@Injectable()
export class SignInService {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly userService: UserService,
    private readonly authorizationService: AuthorizationService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async start(query: AuthorizeQuery, sessionId?: string): Promise<string> {
    const { state } = query;

    const client = await this.clientRepository.find(query.client_id);
    if (!client) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'unknown client_id',
      );
    }

    const redirectUri = query.redirect_uri;
    const registeredUris = client.redirectUris ?? [];

    if (!redirectUri || !registeredUris.includes(redirectUri)) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_REQUEST,
        'redirect_uri is not registered for this client',
      );
    }

    if (query.response_type !== CODE_RESPONSE_TYPE) {
      return buildUrl(redirectUri, {
        error: OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
        error_description: 'only response_type=code is supported',
        state,
      });
    }

    const grantTypes = client.grantTypes ?? DEFAULT_GRANT_TYPES;

    if (!grantTypes.includes(AUTHORIZATION_CODE_GRANT_TYPE)) {
      return buildUrl(redirectUri, {
        error: OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
        error_description: 'this client is not registered for authorization_code',
        state,
      });
    }

    const allowedScopes = client.allowedScopes;
    const requestedScopes = query.scope?.split(' ').filter(Boolean) ?? allowedScopes;
    const disallowedScopes = requestedScopes.filter(
      (requested) => !allowedScopes.includes(requested),
    );

    if (disallowedScopes.length > 0) {
      return buildUrl(redirectUri, {
        error: OAUTH_ERRORS.INVALID_SCOPE,
        error_description: 'scope exceeds what this client may request',
        state,
      });
    }

    const scope = requestedScopes.join(' ');

    const request = await this.authorizationService.createRequest({
      clientId: client.id,
      redirectUri,
      scope,
      state,
    });

    const session = await this.sessionService.findActive(sessionId);
    if (session && session.clientId === client.id) {
      return this.issue(request, session.userId, session.email);
    }

    return buildUrl(this.loginAppUrl(), { interaction: request.id });
  }

  async describe(interactionId: string): Promise<InteractionDetails> {
    const request = await this.assertActiveRequest(interactionId);
    const client = await this.clientRepository.find(request.clientId);

    return {
      clientName: client?.name ?? request.clientId,
      scope: request.scope,
    };
  }

  async complete(
    interactionId: string,
    { email, password }: Credentials,
  ): Promise<SignInResult> {
    const request = await this.assertActiveRequest(interactionId);

    const user = await this.userService.verifyCredentials(
      request.clientId,
      email,
      password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const redirectTo = await this.issue(request, user.id, user.email);
    const session = await this.sessionService.start(
      user.id,
      user.email,
      request.clientId,
    );

    return { redirectTo, sessionId: session.id };
  }

  async endSession(sessionId?: string): Promise<void> {
    await this.sessionService.end(sessionId);
  }

  private async issue(
    request: RequestEntity,
    userId: string,
    email: string,
  ): Promise<string> {
    const code = await this.authorizationService.issueCode(request, {
      id: userId,
      email,
    });
    if (!code) {
      throw new NotFoundException('This sign-in has already been completed');
    }

    return buildUrl(request.redirectUri, {
      code,
      state: request.state ?? undefined,
    });
  }

  private async assertActiveRequest(interactionId: string) {
    const request =
      await this.authorizationService.findActiveRequest(interactionId);
    if (!request) {
      throw new NotFoundException(
        'This sign-in link has expired. Start again from the application.',
      );
    }

    return request;
  }

  private loginAppUrl(): string {
    return (
      this.configService.get<string>(ENV.LOGIN_APP_URL) ?? DEFAULT_LOGIN_APP_URL
    );
  }
}
