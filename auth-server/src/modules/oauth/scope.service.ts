import { Injectable } from '@nestjs/common';
import { OAUTH_ERRORS } from '@modules/oauth/oauth.constants';
import { OauthException } from '@modules/oauth/oauth.exception';

// What a caller may ask for is an OAuth question, not a token one: the token
// module mints whatever scope it is handed, and this decides what that is.
// Every grant narrows against some ceiling — the client's own scopes, or what a
// refresh token was issued for — and none of them may widen it. Keeping it a
// service rather than a function keeps `invalid_scope` thrown in one place.
@Injectable()
export class ScopeService {
  // Omitting the requested scope grants the whole ceiling; supplying one
  // narrows it.
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
