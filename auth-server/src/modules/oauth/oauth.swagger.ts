import {
  CLIENT_BASIC_SECURITY,
  ADMIN_KEY_SECURITY,
} from '@config/swagger.config';

const RFC_ERROR_SCHEMA = (example: string) => ({
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const, example },
    error_description: { type: 'string' as const },
  },
});

export const OAUTH_SWAGGER = {
  API_TAG: 'OAuth',

  AUTHORIZE: {
    operation: {
      summary: 'Authorization endpoint (start of the authorization code flow)',
      description:
        'RFC 6749 §4.1.1, reached through the browser, never called as an ' +
        'API. Query parameters: `response_type=code`, `client_id`, ' +
        '`redirect_uri` (must match one registered for the client exactly), ' +
        '`scope` (include `openid` for an ID token), `state`, `nonce`, ' +
        '`code_challenge` and `code_challenge_method=S256` — PKCE is ' +
        'mandatory.\n\n' +
        'On success it redirects to the provider login page with an ' +
        '`interaction` id. If the client or its redirect_uri cannot be ' +
        'verified it answers 400 here and redirects nowhere; any later error ' +
        'is sent back to the redirect_uri as `error`, `error_description` and ' +
        '`state`.',
    },
    responses: {
      302: { description: 'To the login page, or back to the client with an error.' },
      400: {
        description: 'Unknown client_id, or a redirect_uri not registered for it.',
        schema: RFC_ERROR_SCHEMA('invalid_request'),
      },
    },
  },

  INTERACTION: {
    operation: {
      summary: 'Describe a pending sign-in (provider login app only)',
      description:
        'What the login page shows while the person decides: which client is ' +
        'asking and for which scopes.',
    },
    security: ADMIN_KEY_SECURITY,
    params: [{ name: 'interactionId', description: 'From the login page URL.' }],
    responses: {
      200: { description: 'The client name and the scope being requested.' },
      403: { description: 'Missing or wrong admin key.' },
      404: { description: 'Unknown or expired interaction.' },
    },
  },

  INTERACTION_ACCEPT: {
    operation: {
      summary: 'Complete a pending sign-in (provider login app only)',
      description:
        'The login app has already checked the person with the identity ' +
        'provider and says who signed in: `subject` (the user id) and ' +
        '`email`. This server believes it on the strength of the admin key and ' +
        'never sees how the person proved it. A single-use code is issued and ' +
        'the answer says where to send the browser: the client redirect_uri, ' +
        'with `code` and `state`.',
    },
    security: ADMIN_KEY_SECURITY,
    params: [{ name: 'interactionId', description: 'From the login page URL.' }],
    responses: {
      200: { description: '`{ redirectTo }` — back to the client with the code.' },
      403: { description: 'Missing or wrong admin key.' },
      404: { description: 'Unknown, expired or already completed interaction.' },
    },
  },

  JWKS: {
    operation: {
      summary: 'Public signing keys (JWK Set, RFC 7517)',
      description:
        'The public half of the key every token is signed with. A client ' +
        'verifies its ID token here, an API its access tokens: take the ' +
        'key whose `kid` matches the token header, and accept only RS256. ' +
        'No private member is ever included.',
    },
    responses: {
      200: {
        description: '`{ keys: [{ kty, n, e, kid, alg: "RS256", use: "sig" }] }`',
      },
    },
  },

  TOKEN: {
    operation: {
      summary: 'Token endpoint (all grants)',
      description:
        'RFC 6749 §3.2. One endpoint serves every grant; which body fields ' +
        'apply depends on `grant_type`:\n\n' +
        '- **authorization_code** — `code`, `redirect_uri` (the same one the ' +
        'flow started with) and `code_verifier` (PKCE) required. The code is ' +
        'single-use. With `openid` in the granted scope, the response carries ' +
        'an `id_token`.\n' +
        '- **client_credentials** — no extra fields. The token stands for the ' +
        'client itself, so there is no refresh token: ask again with the ' +
        'secret instead.\n' +
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
            enum: ['authorization_code', 'client_credentials', 'refresh_token'],
            example: 'authorization_code',
          },
          code: {
            type: 'string' as const,
            description: 'Required for `grant_type=authorization_code`.',
          },
          redirect_uri: {
            type: 'string' as const,
            description:
              'Required for `grant_type=authorization_code`: the same value ' +
              'sent to the authorization endpoint.',
            example: 'http://localhost:3001/api/auth/callback',
          },
          code_verifier: {
            type: 'string' as const,
            description:
              'Required for `grant_type=authorization_code`: the PKCE secret ' +
              'behind the code_challenge.',
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
            id_token: {
              type: 'string' as const,
              description:
                'OpenID Connect ID token (signed JWT, `aud` = client_id). Only ' +
                'from authorization_code, and only when `openid` was granted.',
            },
            expires_in: { type: 'integer' as const, example: 3600 },
            token_type: { type: 'string' as const, example: 'Bearer' },
            scope: { type: 'string' as const, example: 'openid read write' },
          },
        },
      },
      400: {
        description:
          'RFC 6749 §5.2 error — `invalid_grant` (an unknown, used or ' +
          'expired code or refresh token; a redirect_uri or ' +
          'code_verifier that does not match), `invalid_scope`, ' +
          '`invalid_request` or `unsupported_grant_type`.',
        schema: RFC_ERROR_SCHEMA('invalid_grant'),
      },
      401: {
        description: 'Missing, malformed or invalid client credentials.',
      },
    },
  },
} as const;
