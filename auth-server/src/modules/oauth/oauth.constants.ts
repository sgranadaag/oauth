export const TOKEN_TYPE = 'Bearer';

// The only response_type this server implements: the authorization code flow.
export const CODE_RESPONSE_TYPE = 'code';

// PKCE is mandatory, and only with S256 — `plain` would send the verifier
// itself on the front channel.
export const PKCE_METHOD = 'S256';

// The scope that turns an OAuth request into an OpenID Connect one: with it,
// the code exchange also returns an ID token.
export const OPENID_SCOPE = 'openid';

export const DEFAULT_AUTH_FRONT_URL = 'http://localhost:3003';

// RFC 6749 §4.1.2.1 and §5.2 error codes. The spec fixes these strings;
// `error_description` beside them is free text.
export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
} as const;
