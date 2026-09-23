import type { ApiPropertyOptions } from '@nestjs/swagger';
import { ADMIN_KEY_SECURITY } from '@core/config/swagger.config';

export const CLIENT_SWAGGER = {
  API_TAG: 'Clients',

  CREATE: {
    operation: {
      summary: 'Register a client',
      description:
        'Creates a client and issues its credentials. The `client_id` returned ' +
        'here is what the token endpoint authenticates, and the `clientSecret` ' +
        'is shown exactly once.',
    },
    security: ADMIN_KEY_SECURITY,
    responses: {
      201: { description: 'Client created; credentials returned once.' },
      403: { description: 'Missing or incorrect `x-admin-key` header.' },
    },
  },
} as const;

export const CLIENT_PROPERTY_SWAGGER = {
  NAME: {
    description: 'Human-readable name for the client. Not used for auth.',
    example: 'billing-service',
  },
  ALLOWED_SCOPES: {
    description:
      'Scope ceiling for this client. Every token it or its users obtain is ' +
      "capped at this set. Include 'openid' for the client to receive an ID " +
      'token from the authorization_code grant.',
    example: ['openid', 'read', 'write'],
    type: [String],
  },
  REDIRECT_URIS: {
    description:
      'Where the authorization endpoint may send a code for this client. ' +
      'Compared by exact match — no prefixes, no wildcards. Only needed for ' +
      'authorization_code.',
    example: ['http://localhost:3001/api/auth/callback'],
    type: [String],
  },
  GRANT_TYPES: {
    description:
      'Which grants this client may use (RFC 7591 `grant_types`). Asking for ' +
      'one it is not registered for is `unauthorized_client`. Defaults to ' +
      '`["authorization_code", "refresh_token"]`, so a service that wants ' +
      '`client_credentials` has to say so.',
    example: ['authorization_code', 'refresh_token'],
    type: [String],
    required: false,
  },
  ACCESS_TOKEN_TTL_SECONDS: {
    description:
      'Lifetime of this client\'s access tokens, in seconds. Omit to use the ' +
      "server default (3600). Minimum 60. It cannot be asked for per request: " +
      'a token lifetime is policy, not a parameter.',
    example: 900,
    required: false,
  },
  CLIENT_ID: {
    description: 'The OAuth `client_id`. Use it as the Basic auth username.',
    example: '3f2a9e10-6f1d-4a2b-9c3e-5d7a1b2c4e8f',
  },
  CLIENT_SECRET: {
    description:
      'The OAuth `client_secret`, returned **only here**. There is no endpoint ' +
      'that reads it back — if it is lost, issue a new client.',
    example: 'c13d07eb-78b4-4e24-9f3a-c18cccc63c0f',
  },
} satisfies Record<string, ApiPropertyOptions>;
