# oauth

A from-scratch RFC 6749 OAuth 2.0 authorization server, built on
[NestJS](https://nestjs.com/) and [`oidc-provider`](https://github.com/panva/node-oidc-provider).
It supports three grants — **Client Credentials**, **Resource Owner
Password Credentials (ROPC)**, and **Refresh Token** — issues RS256-signed
JWT access tokens, and exposes its own REST API for provisioning the
clients and users that authenticate against it. There is no UI, no
Authorization Code grant, and no consent screen — everything here is
meant to be driven by API calls.

## Core concepts

- **Client** — an application allowed to request tokens. Created by an
  admin via `POST /clients`, with a name and a set of `allowedScopes`.
  A client's own `id` **is** its OAuth `client_id`.
- **User** — belongs to exactly one client, created via
  `POST /users/signup`,
  authenticated as that client the same way the token endpoint is (HTTP
  Basic auth, `client_id:client_secret`) rather than by an unauthenticated
  `clientId` param. A user has no scopes of its own — it inherits its
  owning client's full `allowedScopes` whenever it authenticates
  (Resource Owner Password Credentials grant).
- **Scope** — a plain string (e.g. `read`, `write`). The set of scopes
  the server recognizes at all is a static list
  (`SUPPORTED_SCOPES` in `src/modules/oidc/oidc.constants.ts`); a client's
  `allowedScopes` must be drawn from that list, and any token request
  (by client or by user) is capped at the client's `allowedScopes`.

## Setup

```bash
cp .env.example .env                    # fill in real values, see below
docker compose up -d                     # starts Postgres
npm install
npm run migration:run                    # creates clients/users/oidc_models tables
npm run generate-signing-keys            # writes src/secrets/{private,public}.pem
npm run start:dev
```

Required environment variables (`.env`):

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port the app listens on |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | Postgres connection |
| `ADMIN_API_KEY` | Bootstrap credential required to create clients (`x-admin-key` header) |
| `OIDC_ISSUER` | The `iss` value stamped into every issued token, e.g. `http://localhost:3000` |

The signing key pair — RSA 2048-bit, RS256 — lives in `src/secrets/` as
**two PEM files and nothing else**, written by
`npm run generate-signing-keys`:

- `private.pem` / `public.pem` (PKCS#1, `-----BEGIN RSA PRIVATE KEY-----`)
  — the single source of truth. Used by this app's own token signing and
  verification (`src/utils/jwt.util.ts`, via `jsonwebtoken`), and by any
  external tooling that expects PEM (openssl, jwt.io, other languages'
  crypto libraries).

`oidc-provider` needs the key as a JWK Set rather than a PEM, but that is
derived in memory at boot (`crypto.createPrivateKey(pem).export({ format:
'jwk' })`) — there are no `.jwk.json` files to keep in sync.

The private half never leaves the server; the public half is the exact
key material a frontend (or any other party) can use to verify a token's
signature independently, without calling back to this server. It's also
served live at `GET /oauth/jwks`. All four files are gitignored —
generate them locally.

A ready-to-import Postman collection covering every endpoint and grant
below (including the error cases) lives at
[`postman/oauth.postman_collection.json`](postman/oauth.postman_collection.json) —
see [`postman/README.md`](postman/README.md) for how to run it.

## Endpoints

| Method & path | Purpose | Auth required |
|---|---|---|
| `POST /clients` | Register a new client, get back its `client_id`/`client_secret` | `x-admin-key: <ADMIN_API_KEY>` header |
| `POST /users/signup` | Register a user under the authenticated client | Basic auth (`client_id:client_secret`) — same shape as the token endpoint |
| `DELETE /users/:userId` | Delete a user owned by the authenticated client | Basic auth (`client_id:client_secret`) |
| `POST /users/change-password` | Change the authenticated user's password | `Authorization: Bearer <access_token>` |
| `POST /oauth/token` | Exchange credentials for a token — shared by all three grants. **This is login.** | Basic auth (`client_id:client_secret`), per grant below |
| `POST /oauth/token/revocation` | Revoke a token — RFC 7009. **This is logout.** | Basic auth (`client_id:client_secret`) |
| `GET /oauth/jwks` | Fetch the public key set used to verify access token signatures | none |

Everything under `/oauth` is served by `oidc-provider`'s own request
pipeline (mounted at `/oauth`), so those request/response shapes follow
RFC 6749 §5 and RFC 7009 exactly — this app does not reformat them.
There are deliberately no `/users/login` or `/users/logout` endpoints:
logging in is the password grant and logging out is revocation, and a
REST facade over either would be a second, subtly different code path
for something the library already implements to spec.

---

## Flow 1 — Client Credentials (machine-to-machine)

Use this when the caller **is** the client itself — a backend service,
a script, a cron job — with no end user involved.

**Step 1 — an admin provisions the client, once:**

```bash
curl -X POST http://localhost:3000/clients \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "billing-service", "allowedScopes": ["read", "write"] }'
```

```json
{
  "clientId": "3f2a9e10-...",
  "clientSecret": "9c4b7e21f8a0...",
  "name": "billing-service",
  "allowedScopes": ["read", "write"]
}
```

`clientSecret` is returned **exactly once**, in plaintext. The server
stores only a bcrypt hash of it (see below) — there is no way to
retrieve it again later, only to issue a new client if it's lost.

**Step 2 — the client requests a token whenever it needs one:**

```bash
curl -X POST http://localhost:3000/oauth/token \
  -u "3f2a9e10-...:9c4b7e21f8a0..." \
  -d "grant_type=client_credentials"
```

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCJ9...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "read write"
}
```

There is **no refresh token** on this grant, by design (RFC 6749 §4.4) —
the client just re-authenticates with its own credentials the next time
it needs a token.

**What the server does, internally, for this request:**
1. `oidc-provider`'s pipeline receives `POST /oauth/token` and parses the
   `Authorization: Basic` header into a client id + secret.
2. It authenticates the client by calling `OidcAdapter.find(client_id)`
   for `modelName === 'Client'`, which delegates to `ClientRepository`
   and decrypts the stored secret for comparison.
3. It confirms `client_credentials` is a grant this client is allowed to
   use, and restricts the token's `scope` to the client's own
   `allowedScopes`.
4. It mints a JWT access token (RS256, signed with the private key from
   `src/secrets/private.pem`) — this whole path is handled natively
   by `oidc-provider` (`features.clientCredentials`), with no custom
   code in between.

---

## Flow 2 — Resource Owner Password Credentials (user login)

Use this when a real end user is logging in with a username and
password, and the calling application is trusted to handle those
credentials directly (this grant only makes sense for a first-party
client, per RFC 6749 §4.3's own guidance).

**Step 1 — an admin provisions the client, once (same as Flow 1):**

```bash
curl -X POST http://localhost:3000/clients \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "mobile-app", "allowedScopes": ["read", "write"] }'
```

**Step 2 — a user is provisioned under that client, authenticated as
that client via the same Basic auth shape the token endpoint uses:**

```bash
curl -X POST http://localhost:3000/users/signup \
  -u "<clientId>:<clientSecret>" \
  -H "Content-Type: application/json" \
  -d '{ "username": "alice", "password": "correct-horse-battery-staple" }'
```

```json
{ "id": "7b1e...", "username": "alice", "scopes": ["read", "write"] }
```

There is no `clientId` in the URL or body — the client proves which
client it is the same way it always proves that, via its own
credentials, so a caller can only ever create users under a client it
actually holds the secret for. `scopes` here just reflects the owning
client's current `allowedScopes` at signup time, for information — it
isn't stored per user. A username only needs to be unique **within**
its client; the same username can exist under two different clients as
two unrelated users.

**Step 3 — the client exchanges the user's credentials for a token:**

```bash
curl -X POST http://localhost:3000/oauth/token \
  -u "<clientId>:<clientSecret>" \
  -d "grant_type=password&username=alice&password=correct-horse-battery-staple"
```

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCJ9...",
  "refresh_token": "hL3n...opaque-string...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "read write"
}
```

An explicit `scope` parameter can be added to request a narrower set —
`grant_type=password&username=alice&password=...&scope=read` — but
requesting anything **outside** the client's `allowedScopes` is rejected
with `invalid_scope`. Omitting `scope` entirely grants the client's full
`allowedScopes`, same as the DTO the signup step returned.

**What the server does, internally, for this request** — `password` has
no native support in `oidc-provider`, so this path runs through code
this project wrote (`PasswordGrantService`), registered via
`provider.registerGrantType('password', ...)`:
1. `oidc-provider`'s pipeline still authenticates the *client* the same
   way as Flow 1 (Basic auth → `OidcAdapter` → `ClientRepository`), and
   confirms `password` is a grant this client may use — before
   `PasswordGrantService` ever runs.
2. `PasswordGrantService.handle()` looks up the user via
   `UserRepository.findByClientAndUsername(client_id, username)` — a
   user is only ever looked up **scoped to the authenticated client**,
   so the same username under a different client is a completely
   different lookup (this is what makes credential reuse across clients
   safe: a correct username+password pair for client A's user "alice"
   will not authenticate against client B, even if client B also has a
   user named "alice").
3. The submitted password is checked against the stored bcrypt hash. Any
   failure (unknown user, wrong password) returns the same
   `invalid_grant` error, rather than distinguishing "wrong password"
   from "no such user".
4. The client's *current* `allowedScopes` is re-read live from
   `ClientRepository` (not the signup-time snapshot from Step 2) and used
   to cap the requested scope, exactly like Flow 1.
5. `PasswordGrantService` explicitly constructs a JWT-formatted access
   token (`new provider.ResourceServer(...)`, `accessTokenFormat: 'jwt'`)
   and an opaque refresh token, then writes the RFC 6749 §5.1 response
   body itself — since this grant is entirely custom code, none of that
   response shaping is automatic here the way it is for the native
   grants.

---

## Refreshing a token

Either grant above that returns a `refresh_token` (only Flow 2 does) can
be exchanged for a new token pair:

```bash
curl -X POST http://localhost:3000/oauth/token \
  -u "<clientId>:<clientSecret>" \
  -d "grant_type=refresh_token&refresh_token=<refresh_token>"
```

This returns a fresh `access_token` **and** a fresh `refresh_token` — the
one just used is immediately consumed and can't be reused (rotation,
RFC 6749 §10.4). A `scope` parameter may again be supplied to narrow the
new token, but never to widen it past what the *original* grant actually
covered — requesting a wider scope on refresh is rejected with
`invalid_scope`. This entire grant is handled natively by
`oidc-provider` (`OidcAdapter` looks up and consumes the stored refresh
token, checks it hasn't expired or already been used) — no custom code
runs here, unlike Flow 2.

## Verifying a token

Access tokens are JWTs (RFC 9068, `typ: at+jwt`), signed RS256. Any
party holding the public key can verify a token's signature and claims
independently, with no call back to this server:

```bash
curl http://localhost:3000/oauth/jwks
```

```json
{ "keys": [ { "kty": "RSA", "use": "sig", "alg": "RS256", "kid": "...", "n": "...", "e": "..." } ] }
```

The same key material is also on disk as `src/secrets/public.pem`
for a frontend build to bundle directly, if fetching it live isn't
convenient. Refresh tokens are **never** JWTs — they're opaque strings by
design, meaningful only to this server.

## Logging out — revocation

There is no logout endpoint of this app's own. Ending a session is RFC
7009 revocation, which `oidc-provider` implements natively
(`features.revocation`) and which writes straight through `OidcAdapter`
to the same `oidc_models` store every other token artifact lives in:

```bash
curl -X POST http://localhost:3000/oauth/token/revocation \
  -u "<clientId>:<clientSecret>" \
  -d "token=<refresh_token>&token_type_hint=refresh_token"
```

It answers `200` with an empty body — including for a token that never
existed, which RFC 7009 §2.2 requires so a caller can't probe the store.

**Only the refresh token can be revoked.** Every access token here is a
JWT, and RFC 7009 refuses structured tokens outright — posting one fails
with `unsupported_token_type` rather than quietly doing nothing. That
follows from what a JWT is: it's verified offline against the published
JWKS with no call back to this server, so revocation could not reach one
even if the endpoint accepted it. The gap is inherent to stateless JWTs,
not an oversight — the alternatives are a database read on every
resource request (giving up the offline verification a JWKS exists for)
or shorter lifetimes.

Revoking the refresh token is what ends the session, and it does more
than delete that one row: `revoke()` cascades to the whole `grantId`, so
the Grant and every token issued under it go too.

**How the server knows which token you mean:** the `token` value *is*
the lookup key. An opaque refresh token is a 256-bit random nanoid, and
that same string is the `id` column in `oidc_models` — `find()` is a
primary-key read, nothing decoded or derived. `token_type_hint` only
reorders which model is tried first; a wrong hint costs one extra query
and changes nothing.

Changing a password does **not** revoke anything either; tokens issued
before the change keep working. Revoke the refresh token alongside it if
you want the session gone.

**Deleting a user does end their refresh tokens**, though — not by
purging the token store, but because `findAccount` resolves the `sub`
against the real `users` table on every refresh, and the grant fails
with `invalid_grant` when it comes back empty. (`oidc-provider`'s
default `findAccount` returns a stub account for any `sub`, which would
have left a deleted user's session minting tokens indefinitely.) Their
access tokens still verify offline until `exp`, same as above.

## Deleting a user

```bash
curl -X DELETE http://localhost:3000/users/<userId> \
  -u "<clientId>:<clientSecret>"      # 204
```

Authenticated as the owning client, the same way signup is. A user
belonging to a *different* client answers `404`, not `403` — otherwise
the response would let one client probe which user ids exist under
another.

## Errors

Every grant renders failures in `oidc-provider`'s standard RFC 6749 §5.2
shape:

```json
{ "error": "invalid_grant", "error_description": "..." }
```

Common `error` values you'll see: `invalid_client` (bad client
credentials), `invalid_grant` (bad user credentials, or an
expired/consumed/unknown refresh token), `invalid_scope` (requested
scope exceeds what's allowed), `unsupported_grant_type` (anything other
than `client_credentials`, `password`, or `refresh_token`).

## How secrets are stored

The two credential types are handled differently:

- **User passwords** are **bcrypt-hashed** (cost 12, one-way). Nothing
  in this server can recover a password once stored.
- **Client secrets** are stored **as issued**. `oidc-provider`'s default
  client authentication compares the submitted secret directly against
  the stored one, so this needs no override — both the token endpoint
  and `BasicTokenGuard` (on the `/users` endpoints) compare in constant
  time (`crypto.timingSafeEqual`, never `===`).

A lost client secret still means issuing a new one — there's no endpoint
that reads a secret back out.

**Worth knowing if you fork this:** storing client secrets in plaintext
means read access to the `clients` table yields every client credential
directly, and RFC 6819 §5.1.4.1.3 recommends hashing them. This
implementation deliberately doesn't, to keep the `oidc-provider`
integration free of a `compareClientSecret` override. If you're adapting
this for anything real, that's the first thing to revisit.

## How it works internally

The flows above are the outside view. For the inside view — what each
file in the `oidc` module does, how a request travels through
`oidc-provider` for each grant, and the library quirks that shaped the
code — see
[`src/modules/oidc/README.md`](src/modules/oidc/README.md).

## Non-goals

No Authorization Code or Implicit grant, no consent screen, no
dynamic/self-service client registration (`oidc-provider`'s own
registration endpoint is disabled — clients only come from `POST
/clients`), no brute-force/rate limiting on login attempts. This is a
reference implementation of the three grants above, not a
general-purpose IdP.
