import type { ApiPropertyOptions } from '@nestjs/swagger';
import { ADMIN_KEY_SECURITY } from '@config/swagger.config';

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
      401: { description: 'Missing or incorrect `x-admin-key` header.' },
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
      'capped at this set. Values must come from the scopes this server ' +
      'recognises (SUPPORTED_SCOPES).',
    example: ['read', 'write'],
    type: [String],
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
