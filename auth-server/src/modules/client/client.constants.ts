import {
  AUTHORIZATION_CODE_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
} from '@modules/oauth/grantTypes/grantTypes.constants';

// What a registration that names no grants gets: the interactive pair, which
// is what an application signing people in needs. Anything else —
// client_credentials for a service — is asked for explicitly, so no client
// ends up able to mint tokens for itself by omission.
export const DEFAULT_GRANT_TYPES: string[] = [
  AUTHORIZATION_CODE_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
];

// Floor for a client's own access token lifetime. Anything shorter is a
// mistake rather than a policy: the client would spend its life refreshing.
export const MIN_ACCESS_TOKEN_TTL_SECONDS = 60;
