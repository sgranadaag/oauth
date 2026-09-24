# auth-server

An RFC 6749 authorization server and OpenID Connect provider, implemented
from scratch on NestJS — no auth library. It registers clients, runs the
authorization code flow and issues tokens, and it also keeps the accounts
(`/users`). **The two sides never call each other**: the oauth side never
sees a password, and the login app, [auth-front](../auth-front), is what
checks one against `/users/verify` before telling the oauth side who
signed in. See the root [README](../README.md) for the whole flow.

## Endpoints

| Endpoint | Called by | What it does |
| --- | --- | --- |
| `GET /oauth/authorize` | the browser | Validates the request, stores it, redirects to the sign-in page |
| `GET /oauth/interactions/:id` | auth-front's server (`x-admin-key`) | Which client is asking, for which scopes |
| `POST /oauth/interactions/:id/accept` | auth-front's server (`x-admin-key`) | Takes `{ subject, email }` — who signed in, already checked — issues a code, says where to send the browser |
| `POST /oauth/token` | the client (Basic `client_id:client_secret`) | Every grant, dispatched on `grant_type` |
| `POST /oauth/revoke` | the client (Basic `client_id:client_secret`) | Ends the session a refresh token belongs to (RFC 7009). 200 either way, so it is no oracle |
| `GET /oauth/jwks` | anyone | The public signing key (JWK Set, RFC 7517), by `kid` — to verify ID and access tokens offline |
| `POST /clients` | an admin (`x-admin-key`) | Registers a client with its scopes, redirect URIs, grants and token lifetime; returns the secret once |
| `POST /users/signup` | anyone | Creates an account. The email is unique across the whole provider |
| `POST /users/verify` | auth-front's server (`x-admin-key`) | Checks email + password, returns the user or 401 |
| `GET /docs` | — | Swagger UI |

`/users` is the identity side: the accounts and their bcrypt hashes. It is
a separate role that happens to run in the same process, and nothing in
`/oauth` calls it — the login app does, and then presents the result.

## The grants

| `grant_type` | Sends | Gets back |
| --- | --- | --- |
| `authorization_code` | `code`, `redirect_uri`, `code_verifier` | Access + refresh token, plus an `id_token` when `openid` was granted |
| `client_credentials` | nothing else | Access token with `sub` = `client_id`, no refresh token |
| `refresh_token` | `refresh_token` | A new pair; the presented token is consumed. Never past the session's fixed end |

There is no `password` grant: a client never handles the user's password,
which is the whole point of the authorization code flow (the OAuth 2.0
Security BCP forbids it). A `grant_type` with no handler answers
`unsupported_grant_type`.

What `authorization_code` checks, all as one `invalid_grant`: the code
exists, is unused and unexpired, was issued to this client, for this exact
`redirect_uri`, and the `code_verifier` hashes (S256) to the stored
challenge. The code is spent before any check runs, so a failed attempt
burns it.

What `/oauth/authorize` refuses to do: redirect anywhere while the client
or its `redirect_uri` are unproven. Those errors are answered here as a 400;
every later error goes back to the client's `redirect_uri`.

What a refresh does **not** do: ask `/users` whether the person still
exists. The oauth side never calls the identity side — the login app
vouched for them at sign-in, and the session is the oauth side's from
there. A session has a fixed end (30 days from sign-in) that rotation
never extends; past it, the person signs in again through the login app.

## Running it

Needs MongoDB:

```bash
cp .env.example .env          # ADMIN_API_KEY must match AUTH_SERVER_ADMIN_KEY in auth-front/.env
npm i
npm run generate-signing-keys # first time: writes secrets/*.pem
npm run start:dev             # http://localhost:3000
```

`LOGIN_APP_URL` is where the provider signs people in — one login app,
not a per-client or per-request choice. `ADMIN_API_KEY` is the
provider's own credential — it registers clients,
opens the interaction endpoints and `/users/verify`, and the login app
presents it too. A wrong one is a **403**, never a 401, so a
misconfiguration cannot pass for a wrong password.

## Layout

```
src/core/                   config, the database connection, the request logger, the signing-key files
src/common/                 guards (Basic, admin key, grant), decorators, generic utils, shared interfaces
src/modules/oauth/          the protocol: authorize, interactions, token endpoint, scopes, errors, grants
src/modules/oauth/submodules/code/       pending authorization requests and one-time codes
src/modules/oauth/submodules/token/      minting, storing and rotating tokens, the signing keys — knows no protocol
src/modules/oauth/submodules/grant/      one service per grant_type, plus the registry that names the set
src/modules/oauth/scope/      the scope policy, shared by /authorize and the grants
src/modules/client/         registered clients, with their redirect URIs
src/modules/user/           the accounts: signup, credential check, bcrypt — called by nothing above
```

Three layers, three path aliases — `@core/*`, `@common/*`,
`@modules/*`. `core/` is wiring that runs once, `common/` is shared and
stateless, `modules/` is the only layer that knows what this server
does. Dependencies run one way, toward `core` and `common`.

The four modules under `oauth/` sit there because nothing else calls
them. Each is a separate Nest module with its own providers, and none of
them knows the protocol.

One MongoDB database, five collections: `clients`, `tokens`,
`authorization_requests`, `authorization_codes` and `users` — the two
collection names kept the protocol's wording when the module became
`code/`, since renaming them would orphan existing documents.
Deliberately light: no tests, no linter, no migrations. The `Dockerfile`
is for the root `docker-compose.yml`, which also writes the signing keys on
first start.
