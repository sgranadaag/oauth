export const TOKEN_TYPE = 'Bearer';

export const CODE_RESPONSE_TYPE = 'code';

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

  UNSUPPORTED_TOKEN_TYPE: 'unsupported_token_type',
} as const;


export const BASIC_CHALLENGE = 'Basic realm="oauth", charset="UTF-8"';
export const MILLISECONDS_PER_SECOND = 1000;
