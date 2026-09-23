import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { BasicTokenRequest } from '@common/interfaces/authenticatedRequest.interface';
import { DEFAULT_GRANT_TYPES } from '@modules/client/client.constants';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';
import type { TokenRequestParams } from '@modules/oauth/interfaces/tokenEndpoint.interface';

@Injectable()
export class GrantTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<BasicTokenRequest>();
    const { grant_type: grantType } = request.body as TokenRequestParams;

    if (!grantType) return true;

    const grantTypes = request.client.grantTypes ?? DEFAULT_GRANT_TYPES;
    if (!grantTypes.includes(grantType)) {
      throw new OauthException(
        OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
        `this client is not registered for ${grantType}`,
      );
    }

    return true;
  }
}
