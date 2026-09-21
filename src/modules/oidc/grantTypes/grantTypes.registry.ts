import type { GrantTypeRegistration } from '../interfaces/grant.interface';
import {
  OTP_GRANT_PARAMS,
  OTP_GRANT_TYPE,
  PASSWORD_GRANT_PARAMS,
  PASSWORD_GRANT_TYPE,
} from '../oidc.constants';
import { PasswordGrantService } from './passwordGrant.service';
import { OtpGrantService } from './otpGrant.service';

export const CUSTOM_GRANT_TYPES: GrantTypeRegistration[] = [
  {
    type: PASSWORD_GRANT_TYPE,
    params: PASSWORD_GRANT_PARAMS,
    service: PasswordGrantService,
  },
  {
    type: OTP_GRANT_TYPE,
    params: OTP_GRANT_PARAMS,
    service: OtpGrantService,
  },
];
