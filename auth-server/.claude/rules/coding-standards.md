---
description: Naming, testing, and library-integration conventions for this repository
---

# Coding standards

See `.claude/rules/architecture.md` first for module structure. This
rule covers naming, testing mechanics, and specific gotchas already
discovered the hard way in this codebase — re-reading library source or
re-discovering these empirically is wasted effort the second time.

## Naming

Every variable, parameter, and field name should say what it holds —
`typeOrmRepository`, `requestedScope`, `modelName`, not `repo`, `s`,
`name`. Idiomatic short names that are unambiguous from context stay
short (`req`/`res`/`ctx`/`dto`/`iv` — a real cryptographic term, not a
lazy abbreviation). When in doubt, prefer the longer, clearer name.

## Comments

Default to none. Only write one when the *why* isn't obvious from the
code itself — a library quirk with no other trace (undocumented
behavior, a workaround for a specific bug), a non-obvious ordering
requirement, or a deliberate trade-off a future reader might otherwise
"fix." Never restate what the code already says.

**Exception — everything exported from `src/utils/` carries JSDoc.**
These are shared helpers called from places that shouldn't need to read
their source, so they get a real doc block instead of inline commentary:

- a one-line summary of what the function does, then any behaviour worth
  knowing (why a check exists, what is cached, what is deliberately
  absent) as prose in the description
- `@param` per argument, describing what it is rather than restating its
  type
- `@returns` describing the value, not just its type
- `@throws` for each failure a caller can reasonably hit

Inside the function body, stay comment-free — if a line needs
explaining, the explanation belongs in the doc block above it.

## `oidc-provider` integration

- The package is ESM-only (`"type": "module"`, no CJS export) and this
  app is CJS — but **import it statically anyway**. Node 22.12+/24
  support `require()` of ESM, so `import { Provider } from 'oidc-provider'`
  compiles and runs fine here; verified against Node 24 with a clean
  `nest build`. Earlier versions of this codebase routed everything
  through a dynamic `import()` in an async factory; that indirection is
  gone and should not be reintroduced. If you ever target Node < 22.12,
  it comes back.
- Client metadata returned from `OidcAdapter.find()` for
  `modelName === 'Client'` must include `redirect_uris: []` and
  `response_types: []` — present but empty, not omitted — or every
  token request fails with `invalid_redirect_uri`, even though this
  server never uses the Authorization Code/Implicit grants those fields
  belong to.
- `'refresh_token'` in a client's `grant_types` only validates if the
  provider's own top-level `scopes` config includes `'offline_access'`
  (`scopes: [...SUPPORTED_SCOPES, 'offline_access']`) — that's a
  provider-wide gate, unrelated to this project's own business scopes.
- A custom grant handler (`PasswordGrantService`) needs
  `grant.addResourceScope(...)` called explicitly on the `Grant`, *and*
  `resource: DEFAULT_RESOURCE_INDICATOR` set on the `RefreshToken` constructor
  properties, or JWT-formatted access tokens silently degrade to opaque
  ones on a later native refresh.
- Any parameter a custom grant handler reads from `ctx.oidc.params`
  (e.g. `scope`) must be declared in `registerGrantType`'s params array,
  or `oidc-provider` silently strips it before the handler ever runs.

## Secrets: passwords hashed, client secrets stored as issued

The two are treated differently, deliberately:

- **User passwords** are bcrypt-hashed at cost 12, in
  `@utils/password.util` and nowhere else. Nothing can recover the
  plaintext.
- **Client secrets** are stored **as issued**, in plaintext
  (`ClientEntity.clientSecret`). `oidc-provider`'s default
  `Client#compareClientSecret` compares the submitted value directly
  against what `OidcAdapter` supplies as `client_secret`, so no override
  is needed and `OidcProvider` has none.

bcrypt's own comparison is already constant-time for a given digest, so
`verifyPassword` needs no extra wrapper — that requirement is about the
plaintext client secret, below.

Comparisons outside the library must be **constant-time**, through
`constantTimeEquals` in `@utils/string.util` — `crypto.timingSafeEqual` behind
a length check, not `===`, since a plaintext secret compared with `===`
leaks itself one character at a time through response latency.
`oidc-provider` does the same internally on the token endpoint. Both
callers share that one helper: `BasicTokenGuard` for the client secret
and `OtpGrantService` for the one-time password.

**Trade-off, accepted knowingly:** anyone with read access to the
`clients` table — a leaked backup, SQL injection, an over-broad DB
grant — obtains every client credential directly. Hashing would remove
that exposure at the cost of the override above. Note RFC 6819 §5.1.4.1.3
recommends hashing; this repo does not follow that recommendation for
client secrets. If you reintroduce hashing, both the adapter's
`client_secret` and `compareClientSecret` have to change together.

## Login and logout are `oidc-provider`'s, not this app's

**There is exactly one place a token is issued (`POST /oauth/token`) and
one place a session ends (`POST /oauth/token/revocation`, RFC 7009,
`features.revocation`).** Both are the library's own pipeline, and both
read and write `oidc_models` through `OidcAdapter`. That store *is* the
session state — there is no second revocation table.

This was arrived at by building the alternative and removing it: a
`revokedToken` module with its own table and a denylist check inside
`BearerTokenGuard`. **Don't reintroduce it**, and in particular:

- **A REST facade over either (`/users/login`, `/users/logout`) is not
  worth it.** It means a second, subtly different issuance path to keep
  in sync — and `UserModule` can't reach the provider to delegate
  properly, because `OidcModule` already imports `UserModule` for the
  password grant. Anything that needs the provider from the user side is
  a cycle; `forwardRef` is not the answer, moving the endpoint into the
  oidc module is.
- **Only refresh tokens are revocable, and an access token is a 400 —
  not a no-op.** `revocation.js` runs `rejectStructuredTokens` before
  any lookup: anything that parses as a JWT throws
  `unsupported_token_type`. Every access token this server issues is a
  JWT (`accessTokenFormat: 'jwt'`), so `POST /oauth/token/revocation`
  accepts refresh tokens and nothing else. Revoking one cascades —
  `revoke()` deletes the whole `grantId`, not just the row named.
  Making `BearerTokenGuard` consult the store would buy immediate
  invalidation for this server's own routes only, at the cost of a
  database read per request and the offline-verification property the
  JWKS exists to provide.
- **An opaque token's value is its row id.** `opaque.js` returns
  `{ value: this.jti }`, and `OidcAdapter.upsert` stores under that id,
  so `find(tokenValue)` is a primary-key read. Nothing derives or
  decodes it — which is why `bitsOfOpaqueRandomness` (256) is the only
  thing making a refresh token unguessable.
- **A `revoked: boolean` claim cannot work.** A JWT is signed and
  immutable once issued; the copy the client holds can never be edited.
  Revocation state is mutable and server-side, a claim is fixed at
  issuance — that asymmetry is the whole reason revocation needs a
  lookup.
- **`signAccessToken` generates the `jti` itself** — excluded from the
  `claims` parameter's type, not merely defaulted. RFC 9068 §2.2
  requires one, and generating it here means no caller can mint two
  tokens sharing an identifier.

- **`findAccount` must resolve against the real `users` table.** The
  library's default returns a stub account for any `sub`, and the
  refresh grant only rejects when it comes back undefined — so with the
  default, a deleted user's refresh token keeps minting access tokens
  forever. This is why `oidcConfig` takes a `UserRepository`, and why
  deleting a user needs no session-purging code of its own. Don't
  remove it, and don't "optimise" it into a cache.

Changing a password revokes nothing. Say so rather than implying
otherwise.

## Express 5 route patterns

Nest 11+ runs on Express 5, which uses path-to-regexp 8 — **an unnamed
wildcard is a boot-time crash, not a warning**. `forRoutes('*')` looks
right and is what most Nest examples still show, but Nest normalises it
to `/*` and hands it straight to `app.use`
(`middleware-module.js#registerHandler`), where path-to-regexp throws
`Missing parameter name at index 2`. Use a *named* wildcard —
`forRoutes('*splat')` — or `'{*splat}'`. Verified against the installed
express@5.2.1: `/*` throws, `/*splat` and `/{*splat}` both bind.
