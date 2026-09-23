import { ENV } from '@constants/environment.constant';

export const TOKEN_TYPE = 'Bearer';

// The only response_type this server implements: the authorization code flow.
export const CODE_RESPONSE_TYPE = 'code';

// PKCE is mandatory, and only with S256 — `plain` would send the verifier
// itself on the front channel.
export const PKCE_METHOD = 'S256';

// The scope that turns an OAuth request into an OpenID Connect one: with it,
// the code exchange also returns an ID token.
export const OPENID_SCOPE = 'openid';

// The identity providers this server knows, mapped from the `idp` parameter
// of an authorization request to the sign-in page that serves it. `idp` is a
// vendor parameter, not an RFC one — Auth0 calls it `connection`, Keycloak
// `kc_idp_hint`; the idea is the same: the client says *which* identity the
// person should prove, and the provider decides where that happens.
//
// Each URL is read from the environment, so adding a provider is one entry
// here plus one variable — never a change in the flow.
export const IDENTITY_PROVIDERS = {
  local: {
    env: ENV.LOCAL_IDP_LOGIN_URL,
    defaultUrl: 'http://localhost:3003/login',
  },
} as const satisfies Record<string, { env: string; defaultUrl: string }>;

// What an authorization request without an `idp` gets: the provider's own
// accounts, `/users`, through its own login app.
export const DEFAULT_IDENTITY_PROVIDER = 'local';


// RFC 6749 §4.1.2.1 and §5.2 error codes. The spec fixes these strings;
// `error_description` beside them is free text.
export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  // §4.1.2.1 and §5.2: the client is authenticated, but is not registered
  // for what it is asking — this grant, this response type.
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  INVALID_GRANT: 'invalid_grant',
  INVALID_SCOPE: 'invalid_scope',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
} as const;
