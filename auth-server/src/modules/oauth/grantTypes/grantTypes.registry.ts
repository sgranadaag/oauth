import type { GrantTypeRegistration } from '@modules/oauth/grantTypes/grantTypes.interfaces';
import {
  AUTHORIZATION_CODE_GRANT_TYPE,
  CLIENT_CREDENTIALS_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
} from '@modules/oauth/grantTypes/grantTypes.constants';
import { AuthorizationCodeGrantService } from '@modules/oauth/grantTypes/services/authorizationCodeGrant.service';
import { ClientCredentialsGrantService } from '@modules/oauth/grantTypes/services/clientCredentialsGrant.service';
import { RefreshTokenGrantService } from '@modules/oauth/grantTypes/services/refreshTokenGrant.service';

// Adding a grant means writing its service and appending one entry here:
// OauthModule turns every `service` into a provider, and OauthService dispatches
// on `type`. Nothing else changes.
export const GRANT_TYPES: GrantTypeRegistration[] = [
  {
    type: AUTHORIZATION_CODE_GRANT_TYPE,
    service: AuthorizationCodeGrantService,
  },
  {
    type: CLIENT_CREDENTIALS_GRANT_TYPE,
    service: ClientCredentialsGrantService,
  },
  {
    type: REFRESH_TOKEN_GRANT_TYPE,
    service: RefreshTokenGrantService,
  },
];
