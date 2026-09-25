# Standards backlog

What this server still owes the specifications, and where each piece would land.
Written after the RFC 6749 conformance pass; everything listed here is *not*
implemented yet.

## Already in place

| Spec | Status |
|---|---|
| RFC 6749 — authorization code, client credentials, refresh token | implemented |
| RFC 6749 §5.2 — error codes, shapes and statuses | implemented |
| RFC 7009 — token revocation | implemented |
| RFC 7517 / 7638 — JWK Set, `kid` as thumbprint | implemented |
| RFC 7617 — HTTP Basic client authentication | implemented |
| RFC 9068 — `at+jwt` access tokens | implemented |

Refresh token rotation with replay detection, and code-reuse revocation, both go
beyond what RFC 6749 requires and match RFC 9700 §4.14.

---

## 1 · Gaps inside what already exists

Small, self-contained, and they close real holes rather than add surface.

### 1.1 Client secrets are stored in plaintext

`ClientService.create` writes `randomUUID()` straight into `clients.clientSecret`,
and `BasicTokenGuard` compares against it directly. A database read hands over
every client credential.

The project already does this correctly for people: `user.util.ts` hashes with
bcrypt at cost 12. Client secrets deserve the same treatment — RFC 6749 §10.1
calls the secret a password and says to store it the way passwords are stored.

- `client.entity.ts` — rename the column to `clientSecretHash`
- `client.service.ts` — hash before saving, keep returning the plaintext once
- `basicToken.guard.ts` — `bcrypt.compare`, which removes the `constantTimeEquals`
  call on this path (bcrypt's comparison is already constant-time for a digest)

### 1.2 `redirect_uri` is not validated at registration

RFC 6749 §3.1.2 requires an absolute URI and forbids a fragment component. Today
`@IsUrl({ require_tld: false })` accepts `https://app.test/cb#anything`.

- `createClient.dto.ts` — a validator that rejects fragments and relative URIs

### 1.3 `scope` syntax is not checked

RFC 6749 §3.3 defines `scope-token = 1*( %x21 / %x23-5B / %x5D-7E )` — printable
ASCII without space, quote or backslash. Any string passes today, so a scope
containing a quote would round-trip into an `error_description` and violate the
charset rule of §5.2.

- a shared validator used by `createClient.dto.ts` and the authorize query

### 1.4 `client_secret_post` is not supported

RFC 6749 §2.3.1 makes Basic mandatory (done) and the form-encoded body optional.
Plenty of client libraries default to the body, and today they get
`invalid_client` with no way to tell why.

- `basicToken.guard.ts` — accept `client_secret` from the body, and reject a
  request that uses both methods at once, as §2.3 requires

---

## 2 · Standards that complete the picture

### 2.1 RFC 7636 — PKCE

**The largest remaining gap.** RFC 9700 §2.1.1 makes PKCE mandatory for public
clients, and `client-front` is a public client. `state` proves the callback
answers a request this browser started; it does nothing about a code intercepted
in transit. They are not substitutes.

- `signIn.service.ts` — accept and store `code_challenge` + `code_challenge_method`
- `codeValue.entity.ts` — two more columns
- `authorizationCodeGrant.service.ts` — verify `code_verifier`, S256 only
- `client-front/src/services/auth.service.ts` — generate the verifier, send the
  challenge, keep the verifier next to `state` in the transaction
- `client-front/src/utils/crypto.util.ts` — S256 via `crypto.subtle.digest`

Removing PKCE was a deliberate decision to keep the flow readable. Reversing it
is the one item here that changes the story the diagrams tell.

### 2.2 RFC 9207 — Authorization server issuer identification

Adds `iss` to the authorization response so a client talking to more than one
provider cannot be tricked into sending a code to the wrong one (mix-up attack).

- `signIn.service.ts` — one more parameter in every `buildUrl` for the success path
- `client-front` — compare it against `ISSUER`, which is already a constant

Half a day at most, and it is the cheapest security win left.

### 2.3 RFC 8414 — Authorization server metadata

`GET /.well-known/oauth-authorization-server` returning `issuer`,
`authorization_endpoint`, `token_endpoint`, `revocation_endpoint`, `jwks_uri`,
`grant_types_supported`, `response_types_supported`, `scopes_supported`,
`token_endpoint_auth_methods_supported`.

Every value already exists in constants or config. It is the document that lets a
generic client configure itself instead of being told each URL by hand.

- a new module, or a route on the existing oauth controller

### 2.4 RFC 7662 — Token introspection

`POST /oauth/introspect` answering `{ active, scope, client_id, sub, exp, ... }`.

This is the missing answer to a question the current design raises: access tokens
are JWTs verified offline, so **a resource server has no way to learn that a
session was revoked**. Introspection is how it asks.

- a new flow under `oauth/flows/`, authenticated like the token endpoint

### 2.5 RFC 6750 — Bearer token usage

No protected resource exists in this project, so nothing demonstrates how one
should answer: `401` with `WWW-Authenticate: Bearer error="invalid_token"`,
`403` with `error="insufficient_scope"`.

The client-credentials diagram already draws a Resource API that is not real.
A small example service would make that diagram honest and give introspection
somewhere to be called from.

---

## 3 · Optional, only if the project grows

| Spec | What it adds | Note |
|---|---|---|
| RFC 7591 / 7592 | Dynamic client registration | `POST /clients` already does this in a non-standard shape; aligning is mostly field renames plus `client_id_issued_at` and `client_secret_expires_at` |
| RFC 8628 | Device authorization grant | For input-constrained devices |
| RFC 9449 | DPoP — sender-constrained tokens | The modern answer to bearer-token theft |
| RFC 7523 | `private_key_jwt` client authentication | Replaces shared secrets for confidential clients |
| RFC 8693 | Token exchange | Service-to-service delegation |
| RFC 8705 | mTLS client auth and certificate-bound tokens | Needs infrastructure beyond this project |

---

## 4 · Deliberately out of scope

These are decisions, not omissions. They are recorded so a later reader does not
"fix" them.

- **OpenID Connect** — no `id_token`, no `openid` scope, no `nonce`, no UserInfo.
  This server authorizes; it does not describe who someone is.
- **Implicit grant** (§4.2) — removed from OAuth 2.1 and forbidden by RFC 9700.
- **Resource owner password credentials** (§4.3) — same.
- **`aud` as a resource indicator** (RFC 8707) — a fixed `urn:oauth:default` is
  used instead.
- **Accounts scoped per client** — outside the model RFC 6749 assumes, which
  treats the resource owner as a single identity. Not forbidden, and it is what
  makes the session cookie deliberately not SSO.
