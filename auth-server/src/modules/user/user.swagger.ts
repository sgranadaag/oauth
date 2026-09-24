import type { ApiPropertyOptions } from '@nestjs/swagger';
import { ADMIN_KEY_SECURITY } from '@core/config/swagger.config';

export const USER_SWAGGER = {
  API_TAG: 'Users',

  SIGNUP: {
    operation: {
      summary: 'Create an account',
      description:
        'Public, like signing up for any identity provider.\n\n' +
        '**The account belongs to one client**, named by `clientId`, which ' +
        'must already be registered. The same email under two clients is two ' +
        'unrelated people, and an account can only ever sign in to its own ' +
        'client.',
    },
    responses: {
      201: { description: 'Account created.' },
      400: {
        description: 'The email is not a valid address, or the client_id is unknown.',
      },
      409: { description: 'That email is already registered for this client.' },
    },
  },

  VERIFY: {
    operation: {
      summary: 'Check a set of credentials (login app only)',
      description:
        'What the login app (auth-front, server side) calls when a person ' +
        'signs in on the provider page. Answers the same 401 for an unknown ' +
        'email and a wrong password, so it cannot be used to list accounts.',
    },
    security: ADMIN_KEY_SECURITY,
    responses: {
      200: { description: 'The credentials are right; the user is returned.' },
      401: { description: 'Wrong credentials.' },
      403: { description: 'Missing or wrong admin key.' },
    },
  },
} as const;

export const USER_PROPERTY_SWAGGER = {
  ID: {
    example: '7b1e4c92-0d3a-4f8b-a6c1-2e5f9d0a3b74',
  },
  CLIENT_ID: {
    description: 'The client this account belongs to.',
    example: '7b1e4c92-0d3a-4f8b-a6c1-2e5f9d0a3b74',
  },

  EMAIL: {
    description: 'Unique across the whole provider.',
    example: 'alice@example.com',
  },
  PASSWORD: {
    description: 'Stored bcrypt-hashed; never returned by any endpoint.',
    example: 'correct-horse-battery-staple',
  },
} satisfies Record<string, ApiPropertyOptions>;
