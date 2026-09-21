import type { ApiPropertyOptions } from '@nestjs/swagger';
import { BEARER_SECURITY, CLIENT_BASIC_SECURITY } from '@config/swagger.config';

export const USER_SWAGGER = {
  API_TAG: 'Users',

  SIGNUP: {
    operation: {
      summary: 'Register a user under the authenticated client',
      description:
        'The owning client comes from the Basic auth credentials, never from ' +
        'the request body — a caller can only create users under a client ' +
        'whose secret it holds. The new user inherits that client allowedScopes.\n\n' +
        'Logging that user in afterwards is `POST /oauth/token` with ' +
        '`grant_type=password`, the email going in `username`; there is no ' +
        'separate login endpoint here.',
    },
    security: CLIENT_BASIC_SECURITY,
    responses: {
      201: { description: 'User created.' },
      400: { description: 'The email is not a valid address.' },
      401: { description: 'Missing, malformed or invalid client credentials.' },
      409: { description: 'That email already exists under this client.' },
    },
  },

  DELETE: {
    operation: {
      summary: 'Delete a user owned by the authenticated client',
      description:
        'Authenticated as the owning client, the same way signup is — a ' +
        'client can only delete users it created. A user belonging to a ' +
        'different client reports as not found rather than forbidden, so the ' +
        'response cannot be used to probe ids across clients.\n\n' +
        "The deleted user's outstanding refresh tokens stop working " +
        'immediately: the refresh grant resolves the account on every use and ' +
        'fails with `invalid_grant` once it is gone. Access tokens already ' +
        'issued still verify offline until their `exp`.',
    },
    security: CLIENT_BASIC_SECURITY,
    params: [
      {
        name: 'userId',
        description: 'The `id` returned by signup — also the token `sub`.',
        example: '7b1e4c92-0d3a-4f8b-a6c1-2e5f9d0a3b74',
      },
    ],
    responses: {
      204: { description: 'User deleted.' },
      401: { description: 'Missing, malformed or invalid client credentials.' },
      404: {
        description: 'No such user under the authenticated client.',
      },
    },
  },

  CHANGE_PASSWORD: {
    operation: {
      summary: 'Change the password of the authenticated user',
      description:
        'The account comes from the `sub` claim of the bearer token, never ' +
        'from the body. The current password is required as proof of ' +
        'possession, so a stolen token alone cannot take over the account. A ' +
        '`client_credentials` token has no user behind its `sub` and is ' +
        'rejected as not found.\n\n' +
        'Tokens issued before the change keep working until they expire — ' +
        'changing a password is not a revocation. To end the session too, ' +
        'follow this with `POST /oauth/token/revocation` on the refresh token.',
    },
    security: BEARER_SECURITY,
    responses: {
      204: { description: 'Password changed.' },
      401: {
        description: 'Invalid bearer token, or the current password is wrong.',
      },
      404: { description: 'The token subject is not a user of this server.' },
    },
  },
} as const;

export const USER_PROPERTY_SWAGGER = {
  EMAIL: {
    description:
      'Unique per client, not globally — the same email may exist under a ' +
      'different client as an unrelated account.',
    example: 'alice@example.com',
  },
  PASSWORD: {
    description: 'Stored bcrypt-hashed; never returned by any endpoint.',
    example: 'correct-horse-battery-staple',
  },
  CURRENT_PASSWORD: {
    description:
      'The password in force right now. Verified against the stored hash ' +
      'before the change is applied.',
    example: 'correct-horse-battery-staple',
  },
  NEW_PASSWORD: {
    description: 'The replacement password, bcrypt-hashed on the way in.',
    example: 'an-entirely-different-passphrase',
  },
  ID: {
    example: '7b1e4c92-0d3a-4f8b-a6c1-2e5f9d0a3b74',
  },
  SCOPES: {
    description:
      "The owning client's current allowedScopes, echoed for information. " +
      'Scopes are never stored per user — they are resolved from the client ' +
      'at token time.',
    type: [String],
    example: ['read', 'write'],
  },
} satisfies Record<string, ApiPropertyOptions>;
