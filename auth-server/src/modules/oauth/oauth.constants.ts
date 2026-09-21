export const TOKEN_TYPE = 'Bearer';

// RFC 6749 §5.2 error codes. The spec fixes these strings; `error_description`
// beside them is free text.
export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
} as const;
