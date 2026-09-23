import type { GrantTypeRegistration } from '@modules/oauth/grant/interfaces/grant.interface';
import {
  AUTHORIZATION_CODE_GRANT_TYPE,
  CLIENT_CREDENTIALS_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
} from '@modules/oauth/grant/grant.constants';
import { AuthorizationCodeGrantService } from '@modules/oauth/grant/services/authorizationCodeGrant.service';
import { ClientCredentialsGrantService } from '@modules/oauth/grant/services/clientCredentialsGrant.service';
import { RefreshTokenGrantService } from '@modules/oauth/grant/services/refreshTokenGrant.service';

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
