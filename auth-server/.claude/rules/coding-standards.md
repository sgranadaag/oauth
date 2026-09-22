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

## Readability over density

Three rules, all about reading a line once and knowing what it does.

**A method that awaits is `async`, and returns plain values.** Don't reach
for `Promise.resolve(...)` to keep a method synchronous: mark it `async`
and return the value. An early return on its own line needs no braces.

```ts
// Yes
async findByClientId(clientId?: string): Promise<ClientEntity | null> {
  if (!clientId) return null;

  return this.typeOrmRepository.findOneBy({ id: clientId });
}

// No — a Promise where a value would do
findByClientId(clientId?: string): Promise<ClientEntity | null> {
  if (!clientId) return Promise.resolve(null);
  ...
}
```

**Name what you awaited; don't inline a call into what you return.** The
name says what the value *is*, which the call site otherwise leaves to the
reader.

```ts
// Yes
const providerUrl = await this.oauthService.authorize(query);

return { url: providerUrl };

// No
return { url: await this.oauthService.authorize(query) };
```

The same applies to a call wrapped in a mapper or a response helper
(`return Dto.fromEntity(await service.find(id))`): await into a named
`const` first. A single call returned on its own — `return
this.oauthService.jwks();` — is already clear and stays as it is.

**A conditional spread gets a name too.** `...(x ? { y: x } : {})` inside
an object literal hides a decision in the middle of the shape being
built. Declare each one above, then spread the names, so the literal reads
as the shape it is.

```ts
// Yes
const refreshTokenField = refreshToken ? { refresh_token: refreshToken } : {};
const idTokenField = idToken ? { id_token: idToken } : {};

return {
  access_token: accessToken,
  expires_in: expiresInSeconds,
  token_type: TOKEN_TYPE,
  scope,
  ...refreshTokenField,
  ...idTokenField,
};

// No — two decisions buried in a literal
return {
  access_token: accessToken,
  ...(refreshToken ? { refresh_token: refreshToken } : {}),
  ...(idToken ? { id_token: idToken } : {}),
};
```

A plain spread of something already named (`...responseOptions`) needs
nothing; it is the inline condition that costs the reader.

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

## Secrets: client secrets stored as issued, passwords not here

- **Client secrets** are stored **as issued**, in plaintext
  (`ClientEntity.clientSecret`), and checked in `BasicTokenGuard`.
- **User passwords are the identity side's, and never reach the oauth
  side.** They live bcrypt-hashed in the `user` module (`users`), which
  checks them at `/users/verify` for the login app and nobody else. The
  oauth side is told the result — who signed in — through the
  key-guarded `accept`.
- **The API key** (`ADMIN_API_KEY`) comes from the environment only.

Comparisons outside a library must be **constant-time**, through
`constantTimeEquals` in `@utils/string.util` — `crypto.timingSafeEqual`
behind a length check, not `===`, since a plaintext secret compared with
`===` leaks itself one character at a time through response latency.

**Trade-off, accepted knowingly:** anyone with read access to the
`clients` collection — a leaked backup, an over-broad database grant —
obtains every client credential directly. Hashing would remove that
exposure; RFC 6819 §5.1.4.1.3 recommends it, and this repo does not
follow that recommendation for client secrets. If you add hashing, the
guard's comparison changes with it.

## Tokens: one place to issue, one place a session ends

**There is exactly one place a token is issued: `POST /oauth/token`**,
through `TokenService`. A second issuance path — a `/login` facade, a
helper that signs its own JWT — is a second thing to keep in sync, and
the first one to drift.

- **An access token is a JWT, verified offline**, so nothing can
  withdraw one before its `exp`. That is the accepted trade-off for a
  verifier that needs no database; keep the lifetime short rather than
  adding a denylist that every resource server would have to consult.
- **A `revoked: boolean` claim cannot work.** A JWT is signed and
  immutable once issued; revocation is mutable server-side state, and
  that asymmetry is why it needs a lookup.
- **A refresh token is opaque, and its value is its document id** — 256
  bits of randomness, which is the only thing making it unguessable.
  Nothing derives or decodes it.
- **A session ends by deleting its refresh tokens**, all of them, by
  `sessionId` — or on its own at its fixed end. Deleting happens today on
  reuse of a consumed token; a revocation endpoint (RFC 7009, or by
  `subject` for the identity side to push), when it is added, does the
  same.
- **A session has a fixed end, and rotation never moves it.**
  `sessionExpiresAt` is set once, at sign-in, and copied onto every
  rotated token; each token's `expiresAt` is capped at it. A sliding
  window — each rotation granting a fresh `REFRESH_TOKEN_TTL_SECONDS` —
  would let a session that is used often enough live forever, and never
  send the person back to be vouched for again.
- **`signAccessToken` generates the `jti` itself** — excluded from its
  `claims` parameter's type, not merely defaulted. RFC 9068 §2.2
  requires one, and generating it there means no caller can mint two
  tokens sharing an identifier.
- **A refresh never asks the `user` module anything.** A person deleted
  there keeps a live session until its fixed end, or until the identity
  side asks for a revocation by `subject` (not written yet). Access
  tokens already issued still verify until `exp` either way.

## Express 5 route patterns

Nest 11+ runs on Express 5, which uses path-to-regexp 8 — **an unnamed
wildcard is a boot-time crash, not a warning**. `forRoutes('*')` looks
right and is what most Nest examples still show, but Nest normalises it
to `/*` and hands it straight to `app.use`
(`middleware-module.js#registerHandler`), where path-to-regexp throws
`Missing parameter name at index 2`. Use a *named* wildcard —
`forRoutes('*splat')` — or `'{*splat}'`. Verified against the installed
express@5.2.1: `/*` throws, `/*splat` and `/{*splat}` both bind.
