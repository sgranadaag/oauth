export const OIDC_PROVIDER = Symbol('OidcProvider');

export const OIDC_ERRORS = Symbol('OidcErrors');

export const OIDC_MOUNT_PATH = '/oauth';

export const DEFAULT_OIDC_ISSUER = 'http://localhost:3000';

export const DEFAULT_RESOURCE_INDICATOR = 'urn:oauth:default';

export const SUPPORTED_SCOPES = ['read', 'write'] as const;

export const OFFLINE_ACCESS_SCOPE = 'offline_access';

export const PASSWORD_GRANT_TYPE = 'password';

export const PASSWORD_GRANT_PARAMS = ['username', 'password', 'scope'];

export const OTP_GRANT_TYPE = 'otp';

export const OTP_GRANT_PARAMS = ['email', 'otp', 'scope'];

// What every client is registered as allowed to use: the two grants
// `oidc-provider` implements natively, plus the custom ones in
// grantTypes.registry.ts. A grant missing here is `unauthorized_client` at the
// token endpoint, however correctly it is registered.
export const CLIENT_GRANT_TYPES = [
  'client_credentials',
  'refresh_token',
  PASSWORD_GRANT_TYPE,
  OTP_GRANT_TYPE,
];
