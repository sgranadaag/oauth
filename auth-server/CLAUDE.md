# auth-server

An RFC 6749 authorization server and OpenID Connect provider
**implemented from scratch** on [NestJS](https://nestjs.com/): no auth
library. It registers clients, runs the authorization code flow with PKCE
and issues tokens, including ID tokens. It also **holds the accounts**
(`user/`), but the two sides stay apart on purpose: the oauth side never
asks the user module about anyone. It does not render the sign-in page —
`auth-front`, the login app, does — and the oauth side never sees a
password: the login app checks it against `/users/verify` and then tells
this server who signed in. See the root [CLAUDE.md](../CLAUDE.md) for how
the three projects fit together.

`POST /oauth/token` serves `authorization_code`, `client_credentials` and
`refresh_token`. The `password` grant was removed on purpose — a password
is typed only on `auth-front` — so don't add it back unless the user asks.
`README.md` has the endpoints and setup.

## Working in this project

- [.claude/rules/architecture.md](.claude/rules/architecture.md) — module
  structure and layering. **Read it before adding or moving any file.**
  The flat-per-module shape (no `domain/application/infrastructure`
  split, no ports/tokens for use cases or repositories) is a settled
  decision reached after two explicit reversals, not a starting point to
  redesign again.
- [.claude/rules/coding-standards.md](.claude/rules/coding-standards.md)
  — naming, comments, secrets and the token rules that are easy to undo
  by accident.

## The shape of the module graph

```
oauth/          speaks RFC 6749 / OIDC: /authorize, the interaction endpoints,
                /token and its grants, the scope policy, the error body
authorization/  pending authorization requests and one-time codes — storage and lifecycle
token/          mints, stores and rotates tokens, signs ID tokens — knows no grant
client/         the registered clients, with their redirect URIs
user/           the accounts and their password hashes — /users/signup and /users/verify
```

**`user/` is a neighbour, not a dependency.** It exports nothing and
`oauth` never imports it: the identity side answers `/users/verify` to the
login app, which then calls `accept` from outside with the result. Two
roles that happen to run in one process — **don't wire them together**,
even though a direct call would now compile.

The direction is one-way: `oauth` depends on the others, never the
reverse. The boundaries that carry most of the design:

- **`oauth` decides, the others store and mint.** Whether a request is
  valid OAuth — the redirect URI, PKCE, the scope, when an ID token is owed
  — is decided in `oauth`. `authorization` stores and expires what it is
  handed; `token` mints what it is told to.
- **`/oauth/authorize` never redirects to an unproven URL.** Unknown
  client or unregistered `redirect_uri` → a 400 here. Only once both check
  out do errors travel back to the client's `redirect_uri`.
- **Codes and interactions are single-use by construction.** Claiming a
  request deletes it; redeeming a code marks it consumed in the same
  filtered write. The winner of a race is whoever's write changed the
  document.
- **Who signed in is told, not checked.** `POST
  /oauth/interactions/:id/accept` takes `{ subject, email }` from the login
  app and issues the code. It is believed because of `AdminGuard`
  (the provider key the login app also holds) — keep both interaction
  endpoints behind it, always: open, `accept` hands out codes for anyone.
- **The identity side vouches once; sessions belong to the oauth side.**
  The oauth side never sees a password and never asks the user module
  anything — not at sign-in, not at refresh. A refresh checks only its own
  record. What bounds a session is its fixed end (`SESSION_TTL_SECONDS`,
  set at sign-in, never extended by rotation): past it the person goes
  back through the login app, where they are vouched for again. Don't add
  a call from `oauth` into `user` — ending a user's sessions early, when
  needed, is a revocation by `subject` that the identity side *asks for*
  (not written yet).

## How it talks to the others

- **From the browser**: `GET /oauth/authorize`, then a redirect to the
  sign-in page of the identity provider the request named, with
  `?interaction=…`. The `idp` parameter picks one of `IDENTITY_PROVIDERS`
  (`local` by default) and each entry reads its URL from the environment,
  so adding a provider is a constant plus a variable — not a change in
  the flow, and not a field on the client.
- **From auth-front's server side**: `POST /users/verify` first, then
  `GET /oauth/interactions/:id` and `POST /oauth/interactions/:id/accept`,
  all three with `ADMIN_API_KEY` in `x-admin-key`. The login app names
  who signed in, never a client or a redirect target: those come from the
  stored request.
- **From anyone, to the identity side**: `POST /users/signup`, public, as
  any account system is.
- **Out of this server**: nothing. It calls no other service.
- **From the client**: `POST /oauth/token` with Basic
  `client_id:client_secret`, server to server; then `GET /oauth/jwks`
  to verify the ID token's signature; and `POST /oauth/revoke` when
  someone signs out of it.
- **From anyone**: `GET /oauth/jwks`, open on purpose — the public half
  of the signing key, derived from `public.pem` only, with the same `kid`
  every token carries in its header.

## Verifying a change

**Deliberately light: no tests, no linter, no formatter.** The
`Dockerfile` exists only for the root `docker-compose.yml`; it builds with
`@rspack/core` (declared, since the Nest CLI needs it for its `rspack`
builder) and reads the signing keys from a mounted `src/secrets/`.
Don't add any of them back unless the user asks. The user runs the app
themselves; don't run `npm run build` or `npm run start:dev` unless
asked — report what changed and what is worth verifying.
