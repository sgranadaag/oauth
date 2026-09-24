import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import type { BasicTokenRequest } from '@common/interfaces/authenticatedRequest.interface';
import { decodeBasicAuth } from '@common/utils/http.util';
import { constantTimeEquals } from '@common/utils/crypto.util';
import { ClientRepository } from '@modules/client/client.repository';
import {
  BASIC_CHALLENGE,
  OAUTH_ERRORS,
} from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';

@Injectable()
export class BasicTokenGuard implements CanActivate {
  constructor(private readonly clientRepository: ClientRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BasicTokenRequest>();
    const authorization = request.header('authorization');
    const credentials = decodeBasicAuth(authorization);

    const body = request.body as { client_id?: string } | undefined;
    const clientId = credentials?.id ?? body?.client_id;

    const client = await this.clientRepository.find(clientId);
    if (!client) {
      throw this.invalidClient(context, !!authorization);
    }

    if (client.isPublic && credentials?.secret) {
      throw this.invalidClient(context, !!authorization);
    }

    if (!client.isPublic) {
      const presented = credentials?.secret;

      if (!presented || !constantTimeEquals(presented, client.clientSecret)) {
        throw this.invalidClient(context, !!authorization);
      }
    }

    request.client = client;
    return true;
  }

  private invalidClient(
    context: ExecutionContext,
    usedAuthorizationHeader: boolean,
  ): OauthException {
    if (!usedAuthorizationHeader) {
      return new OauthException(
        OAUTH_ERRORS.INVALID_CLIENT,
        'client authentication failed',
      );
    }

    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('WWW-Authenticate', BASIC_CHALLENGE);

    return new OauthException(
      OAUTH_ERRORS.INVALID_CLIENT,
      'client authentication failed',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
