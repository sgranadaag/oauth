import {
  CLIENT_BASIC_SECURITY,
} from '@core/config/swagger.config';

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
        '`scope` and `state`. ' +
        'On success it redirects to the provider login page with an ' +
        '`interaction` id — unless the browser already carries a session ' +
        'cookie for this same client, in which case it answers with a code ' +
        'straight away.\n\n' +
        '`prompt=none` says the caller cannot show a login page: with no ' +
        'usable session it answers `login_required` at the redirect_uri ' +
        'instead of redirecting to the provider. That is how a pure frontend ' +
        'asks "am I still signed in?" without trapping a signed-out visitor ' +
        'on a login form.\n\n' +
        'If the client or its redirect_uri cannot be ' +
        'verified it answers 400 here and redirects nowhere; any later error ' +
        'is sent back to the redirect_uri as `error`, `error_description` and ' +
        '`state` — `unauthorized_client` when the client is not registered ' +
        'for `authorization_code`.',
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
      summary: 'Describe a pending sign-in',
      description:
        'What the login page shows while the person decides: which client is ' +
        'asking and for which scopes — and that client\'s id, which the page ' +
        'needs to sign the person in to the right account.\n\n' +
        'Open on purpose: the login page is a pure frontend and holds no ' +
        'credential. Knowing the id reveals only a client name and a scope ' +
        'list, and the id is unguessable, single-use and short-lived — ' +
        'everything that decides where the code goes stays here.',
    },
    params: [{ name: 'interactionId', description: 'From the login page URL.' }],
    responses: {
      200: { description: 'The client id and name, and the scope being requested.' },
      404: { description: 'Unknown or expired interaction.' },
    },
  },

  INTERACTION_ACCEPT: {
    operation: {
      summary: 'Accept a pending sign-in',
      description:
        'Called by the login page once the person is signed in. It takes no ' +
        'credentials: who is accepting is read from the **session cookie** ' +
        'that `POST /oauth/login` set, and that session must belong to the ' +
        'same client the interaction was started for.\n\n' +
        'On success it issues a single-use code and answers where to send ' +
        'the browser (`{ redirectTo }`). It never opens or extends a session ' +
        '— authenticating the person is a separate flow.',
    },
    params: [{ name: 'interactionId', description: 'From the login page URL.' }],
    responses: {
      200: { description: '`{ redirectTo }` — back to the client with the code.' },
      401: { description: 'No active session for the client of this interaction.' },
      404: { description: 'Unknown, expired or already completed interaction.' },
    },
  },

  LOGIN: {
    operation: {
      summary: 'Authenticate a person and open a browser session',
      description:
        'Called by the login page from the browser, with the client the ' +
        'account belongs to and the email and password the person typed. ' +
        'This server owns the accounts, so it checks them itself — there is ' +
        'no credential on the caller, which is why the login page can be a ' +
        'pure frontend.\n\n' +
        'It knows nothing about pending authorization requests: on success ' +
        'it only sets an **httpOnly session cookie** on this origin. Turning ' +
        'that session into a code is `POST /oauth/interactions/:id/accept`, ' +
        'and the next authorization request carrying the cookie skips the ' +
        'login page entirely.\n\n' +
        'The session records the client it was opened for and shortcuts only ' +
        'that one: accounts belong to a client, so this is **not** SSO.\n\n' +
        'A wrong email, a wrong password and an unknown client answer the ' +
        'same 401: telling them apart would list which accounts exist.',
    },
    responses: {
      204: { description: 'Signed in; the session cookie is set.' },
      400: { description: 'A missing clientId, or an email that is not an address.' },
      401: { description: 'Wrong credentials.' },
    },
  },

  REVOKE: {
    operation: {
      summary: 'Revocation endpoint (RFC 7009)',
      description:
        'Ends the session a refresh token belongs to: that token and every ' +
        'one it was rotated from. What "sign out" means for a client.\n\n' +
        'It also ends the **browser** session when the request carries the ' +
        'session cookie, and clears it. Without that, signing out would drop ' +
        'the tokens while leaving the cookie that mints new ones, and the ' +
        'next authorization request would sign the person straight back in.\n\n' +
        'The answer is **200 whether or not the token existed** (§2.2), so ' +
        'the endpoint cannot be used to find out which tokens are real. A ' +
        'token belonging to another client is left alone, just as silently.\n\n' +
        'Access tokens already issued are **not** affected: they are JWTs, ' +
        'verified offline, and stay valid until `exp`.',
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
            description: 'The refresh token to revoke.',
          },
          token_type_hint: {
            type: 'string' as const,
            enum: ['refresh_token', 'access_token'],
            description:
              'Optional hint. This server stores only refresh tokens, so it ' +
              'changes nothing.',
          },
        },
      },
    },
    responses: {
      200: { description: 'Revoked, or there was nothing to revoke.' },
      400: {
        description:
          '`invalid_request` when `token` is missing, or ' +
          '`unsupported_token_type` for a `token_type_hint` that is not ' +
          '`access_token` or `refresh_token` (RFC 7009 §2.1).',
        schema: RFC_ERROR_SCHEMA('invalid_request'),
      },
      401: {
        description: '`invalid_client`, with `WWW-Authenticate: Basic`.',
        schema: RFC_ERROR_SCHEMA('invalid_client'),
      },
    },
  },

  JWKS: {
    operation: {
      summary: 'Public signing keys (JWK Set, RFC 7517)',
      description:
        'The public half of the key every access token is signed with. A ' +
        'verifier takes the key whose `kid` matches the token header and ' +
        'accepts only RS256. No private member is ever included.\n\n' +
        'Published for completeness: `client-front` ships a copy of the same ' +
        'key instead, which is simpler to read but does not survive a key ' +
        'rotation.',
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
        '- **authorization_code** — `code` and `redirect_uri` (the same one ' +
        'the flow started with) required. The code is single-use, and spent ' +
        'before any check runs. Presenting it a second time is denied **and ' +
        'revokes the session the first presentation produced** (§4.1.2).\n' +
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
            example: 'http://localhost:3001/callback',
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
          'RFC 6749 §5.2 error — `unauthorized_client` (the client is not ' +
          'registered for this `grant_type`), `invalid_grant` (an unknown, used or ' +
          'expired code or refresh token; a redirect_uri or ' +
          '`invalid_scope`, ' +
          '`invalid_request` or `unsupported_grant_type`.',
        schema: RFC_ERROR_SCHEMA('invalid_grant'),
      },
      401: {
        description:
          '`invalid_client`. Sent when the client authenticated through the ' +
          'Authorization header, together with `WWW-Authenticate: Basic`. A ' +
          'client_id carried in the body instead answers 400 with the same ' +
          'error code.',
        schema: RFC_ERROR_SCHEMA('invalid_client'),
      },
    },
  },
} as const;
