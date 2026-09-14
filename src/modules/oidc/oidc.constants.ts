export const OIDC_PROVIDER = Symbol('OidcProvider');

export const OIDC_ERRORS = Symbol('OidcErrors');

export const OIDC_MOUNT_PATH = '/oauth';

export const DEFAULT_OIDC_ISSUER = 'http://localhost:3000';

export const DEFAULT_RESOURCE_INDICATOR = 'urn:oauth:default';

export const SUPPORTED_SCOPES = ['read', 'write'] as const;

export const OFFLINE_ACCESS_SCOPE = 'offline_access';

export const PASSWORD_GRANT_TYPE = 'password';

export const PASSWORD_GRANT_PARAMS = ['username', 'password', 'scope'];
