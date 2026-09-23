import { ENV } from '@core/config/env.config';

export const TOKEN_TYPE = 'Bearer';

export const CODE_RESPONSE_TYPE = 'code';

export const PKCE_METHOD = 'S256';

export const OPENID_SCOPE = 'openid';

export const IDENTITY_PROVIDERS = {
  local: {
    env: ENV.LOCAL_IDP_LOGIN_URL,
    defaultUrl: 'http://localhost:3003/login',
  },
} as const satisfies Record<string, { env: string; defaultUrl: string }>;

export const DEFAULT_IDENTITY_PROVIDER = 'local';

export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',

  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
} as const;
