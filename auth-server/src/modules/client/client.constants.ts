import {
  AUTHORIZATION_CODE_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
} from '@modules/oauth/flows/tokenExchange/grant.constants';

export const DEFAULT_GRANT_TYPES: string[] = [
  AUTHORIZATION_CODE_GRANT_TYPE,
  REFRESH_TOKEN_GRANT_TYPE,
];

export const MIN_ACCESS_TOKEN_TTL_SECONDS = 60;
