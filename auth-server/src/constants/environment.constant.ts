export const ENV = {
  PORT: 'PORT',
  MONGO_URI: 'MONGO_URI',
  MONGO_DATABASE: 'MONGO_DATABASE',
  ADMIN_API_KEY: 'ADMIN_API_KEY',
  OIDC_ISSUER: 'OIDC_ISSUER',
  // One per identity provider in `IDENTITY_PROVIDERS`: where its sign-in
  // page lives.
  LOCAL_IDP_LOGIN_URL: 'LOCAL_IDP_LOGIN_URL',
} as const;
