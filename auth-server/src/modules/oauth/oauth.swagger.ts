import { CLIENT_BASIC_SECURITY } from '@config/swagger.config';

const RFC_ERROR_SCHEMA = (example: string) => ({
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const, example },
    error_description: { type: 'string' as const },
  },
});

export const OAUTH_SWAGGER = {
  API_TAG: 'OAuth',

  TOKEN: {
    operation: {
      summary: 'Token endpoint (all grants)',
      description:
        'RFC 6749 §3.2. One endpoint serves every grant; which body fields ' +
        'apply depends on `grant_type`:\n\n' +
        '- **client_credentials** — no extra fields. The token stands for the ' +
        'client itself, so there is no refresh token: ask again with the ' +
        'secret instead.\n' +
        '- **password** — `username` (the user email, under the RFC parameter ' +
        'name) and `password` required.\n' +
        '- **otp** — `email` and `otp` required. The code is single-use: a ' +
        'successful exchange spends it.\n' +
        '- **refresh_token** — `refresh_token` required. The presented token ' +
        'is consumed and a new one issued (rotation). Presenting a consumed ' +
        'token revokes the whole session, on the assumption that a token used ' +
        'twice has been copied.\n\n' +
        '`scope` is optional: omit it to receive the full set the caller is ' +
        'entitled to, or supply a subset to narrow. Requesting anything ' +
        'outside that set fails with `invalid_scope` — and on a refresh, the ' +
        'set is what that token was issued for, never the client full ' +
        'allowedScopes.',
    },
    security: CLIENT_BASIC_SECURITY,
    consumes: 'application/x-www-form-urlencoded',
    body: {
      required: true,
      schema: {
        type: 'object' as const,
        required: ['grant_type'],
        properties: {
          grant_type: {
            type: 'string' as const,
            enum: ['client_credentials', 'password', 'otp', 'refresh_token'],
            example: 'password',
          },
          username: {
            type: 'string' as const,
            description: 'Required for `grant_type=password`: the user email.',
            example: 'alice@example.com',
          },
          password: {
            type: 'string' as const,
            description: 'Required for `grant_type=password`.',
            example: 'correct-horse-battery-staple',
          },
          email: {
            type: 'string' as const,
            description: 'Required for `grant_type=otp`.',
            example: 'alice@example.com',
          },
          otp: {
            type: 'string' as const,
            description: 'Required for `grant_type=otp`.',
            example: '048213',
          },
          refresh_token: {
            type: 'string' as const,
            description: 'Required for `grant_type=refresh_token`.',
          },
          scope: {
            type: 'string' as const,
            description: 'Optional, space-separated.',
            example: 'read write',
          },
        },
      },
    },
    responses: {
      200: {
        description: 'RFC 6749 §5.1 token response.',
        schema: {
          type: 'object' as const,
          properties: {
            access_token: {
              type: 'string' as const,
              description: 'Signed RS256 JWT (RFC 9068, `typ: at+jwt`).',
            },
            refresh_token: {
              type: 'string' as const,
              description:
                'Opaque, never a JWT. Absent for `client_credentials`.',
            },
            expires_in: { type: 'integer' as const, example: 3600 },
            token_type: { type: 'string' as const, example: 'Bearer' },
            scope: { type: 'string' as const, example: 'read write' },
          },
        },
      },
      400: {
        description:
          'RFC 6749 §5.2 error — `invalid_grant` (bad user credentials, or a ' +
          'wrong/expired/used OTP), `invalid_scope`, `invalid_request` or ' +
          '`unsupported_grant_type`.',
        schema: RFC_ERROR_SCHEMA('invalid_grant'),
      },
      401: {
        description: 'Missing, malformed or invalid client credentials.',
      },
    },
  },
} as const;
