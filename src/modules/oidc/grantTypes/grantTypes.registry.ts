import type { GrantTypeRegistration } from '@modules/oidc/oidc.interfaces';
import {
  PASSWORD_GRANT_PARAMS,
  PASSWORD_GRANT_TYPE,
} from '@modules/oidc/oidc.constants';
import { PasswordGrantService } from '@modules/oidc/grantTypes/passwordGrant.service';

export const CUSTOM_GRANT_TYPES: GrantTypeRegistration[] = [
  {
    type: PASSWORD_GRANT_TYPE,
    params: PASSWORD_GRANT_PARAMS,
    service: PasswordGrantService,
  },
];
