import { Injectable } from '@nestjs/common';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';

@Injectable()
export class ScopeService {
  narrow(grantedScope: string, requestedScope?: string): string {
    if (!requestedScope) {
      return grantedScope;
    }

    const granted = grantedScope.split(' ').filter(Boolean);
    const requested = requestedScope.split(' ').filter(Boolean);
    const disallowed = requested.filter((scope) => !granted.includes(scope));

    if (disallowed.length > 0) {
      throw new OauthException(
        OAUTH_ERRORS.INVALID_SCOPE,
        `scope exceeds what was granted: ${disallowed.join(' ')}`,
      );
    }

    return requested.join(' ');
  }
}
