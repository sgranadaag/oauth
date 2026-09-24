export const TOKEN_TYPE = 'Bearer';

export const CODE_RESPONSE_TYPE = 'code';

export const PKCE_METHOD = 'S256';

export const OPENID_SCOPE = 'openid';

export const NO_PROMPT = 'none';

export const DEFAULT_LOGIN_APP_URL = 'http://localhost:3003/login';

export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',

  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',

  LOGIN_REQUIRED: 'login_required',
} as const;
export const MILLISECONDS_PER_SECOND = 1000;
