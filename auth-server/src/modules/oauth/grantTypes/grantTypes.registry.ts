import type { GrantTypeRegistration } from '@modules/oauth/grantTypes/grantTypes.interfaces';
import {
  CLIENT_CREDENTIALS_GRANT_TYPE,
  OTP_GRANT_TYPE,
  PASSWORD_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
} from '@modules/oauth/grantTypes/grantTypes.constants';
import { ClientCredentialsGrantService } from '@modules/oauth/grantTypes/services/clientCredentialsGrant.service';
import { PasswordGrantService } from '@modules/oauth/grantTypes/services/passwordGrant.service';
import { OtpGrantService } from '@modules/oauth/grantTypes/services/otpGrant.service';
import { RefreshTokenGrantService } from '@modules/oauth/grantTypes/services/refreshTokenGrant.service';

// Adding a grant means writing its service and appending one entry here:
// OauthModule turns every `service` into a provider, and OauthService dispatches
// on `type`. Nothing else changes.
export const GRANT_TYPES: GrantTypeRegistration[] = [
  {
    type: CLIENT_CREDENTIALS_GRANT_TYPE,
    service: ClientCredentialsGrantService,
  },
  {
    type: PASSWORD_GRANT_TYPE,
    service: PasswordGrantService,
  },
  {
    type: OTP_GRANT_TYPE,
    service: OtpGrantService,
  },
  {
    type: REFRESH_TOKEN_GRANT_TYPE,
    service: RefreshTokenGrantService,
  },
];
