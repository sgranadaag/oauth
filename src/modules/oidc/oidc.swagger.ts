import { CLIENT_BASIC_SECURITY } from '@config/swagger.config';

const RFC_ERROR_SCHEMA = (example: string) => ({
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const, example },
    error_description: { type: 'string' as const },
  },
});

export const OIDC_SWAGGER = {
  API_TAG: 'OAuth',

  TOKEN: {
    operation: {
      summary: 'Token endpoint (all grants)',
      description:
        'RFC 6749 §3.2. One endpoint serves all three grants; which body ' +
        'fields apply depends on `grant_type`:\n\n' +
        '- **client_credentials** — no extra fields. Returns an access token ' +
        'and no refresh token.\n' +
        '- **password** — `username` and `password` required.\n' +
        '- **refresh_token** — `refresh_token` required. The presented token ' +
        'is consumed and a new one issued (rotation).\n\n' +
        '`scope` is optional everywhere: omit it to receive the client full ' +
        'allowedScopes, or supply a subset to narrow. Requesting anything ' +
        'outside that set fails with `invalid_scope`.',
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
            enum: ['client_credentials', 'password', 'refresh_token'],
            example: 'password',
          },
          username: {
            type: 'string' as const,
            description: 'Required for `grant_type=password`.',
            example: 'alice',
          },
          password: {
            type: 'string' as const,
            description: 'Required for `grant_type=password`.',
            example: 'correct-horse-battery-staple',
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
          'RFC 6749 §5.2 error — `invalid_grant` (bad user credentials, or an ' +
          'expired/consumed/unknown refresh token), `invalid_scope`, ' +
          '`invalid_request` or `unsupported_grant_type`.',
        schema: RFC_ERROR_SCHEMA('invalid_grant'),
      },
      401: {
        description: 'RFC 6749 §5.2 error — `invalid_client`.',
        schema: RFC_ERROR_SCHEMA('invalid_client'),
      },
    },
  },

  REVOCATION: {
    operation: {
      summary: 'Revoke a token (logout)',
      description:
        'RFC 7009. Deletes the presented token from the store — and, for a ' +
        'refresh token, consumes the grant behind it, so no further access ' +
        'token can be minted from that session. This is how a user logs out.\n\n' +
'**Only refresh tokens are revocable here.** Every access token this ' +
        'server issues is a JWT, and RFC 7009 revocation rejects structured ' +
        'tokens outright — posting one fails with `unsupported_token_type`, ' +
        'not a silent no-op. That is by design: a JWT is verified offline ' +
        'against `GET /oauth/jwks` with no call back here, so this endpoint ' +
        'could not invalidate one even if it accepted it. Revoking the ' +
        'refresh token deletes the whole grant behind it, and the short ' +
        'access-token lifetime closes the remaining window.\n\n' +
        'The `token` value is the lookup key itself — an opaque refresh ' +
        'token is the row id in the token store, nothing more.\n\n' +
        'Returns 200 for an unknown token as well as a revoked one — RFC ' +
        '7009 §2.2 requires that, so a caller cannot probe which tokens ' +
        'exist.',
    },
    security: CLIENT_BASIC_SECURITY,
    consumes: 'application/x-www-form-urlencoded',
    body: {
      required: true,
      schema: {
        type: 'object' as const,
        required: ['token'],
        properties: {
          token: {
            type: 'string' as const,
            description:
              'The refresh token to revoke. A JWT access token is rejected ' +
              'with `unsupported_token_type`.',
          },
          token_type_hint: {
            type: 'string' as const,
            enum: ['refresh_token'],
            description:
              'Optional, and only ever a hint: it reorders which token type ' +
              'is looked up first. A wrong hint costs one extra query and ' +
              'never changes the outcome.',
            example: 'refresh_token',
          },
        },
      },
    },
    responses: {
      200: {
        description:
          'Revoked, or the token was already unknown — indistinguishable by ' +
          'design. Empty body.',
      },
      400: {
        description:
          '`unsupported_token_type` — the presented token is a structured ' +
          'JWT, which cannot be revoked. Or `invalid_request`, when the ' +
          'token belongs to a different client than the one authenticating.',
        schema: RFC_ERROR_SCHEMA('unsupported_token_type'),
      },
      401: {
        description: 'RFC 6749 §5.2 error — `invalid_client`.',
        schema: RFC_ERROR_SCHEMA('invalid_client'),
      },
    },
  },

  JWKS: {
    operation: {
      summary: 'Public signing keys (JWKS)',
      description:
        'The public half of the RS256 signing key, so any party can verify an ' +
        'access token offline without calling back here. Private key material ' +
        'is never included.',
    },
    responses: {
      200: {
        description: 'RFC 7517 JSON Web Key Set.',
        schema: {
          type: 'object' as const,
          properties: {
            keys: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  kty: { type: 'string' as const, example: 'RSA' },
                  use: { type: 'string' as const, example: 'sig' },
                  alg: { type: 'string' as const, example: 'RS256' },
                  kid: { type: 'string' as const },
                  n: { type: 'string' as const },
                  e: { type: 'string' as const, example: 'AQAB' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
