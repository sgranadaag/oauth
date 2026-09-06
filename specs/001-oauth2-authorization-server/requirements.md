# Requirements: OAuth 2.0 Authorization Server (RFC 6749)

Status: draft

## Summary

A reference implementation of an RFC 6749 OAuth 2.0 authorization server,
built from scratch as one of the freely-replicable examples on the user's
GitHub profile. The server acts as both the **authorization server** and
the **resource owner's** account store (registration and login only — no
resource-server or standalone client role, no consent UI). There are two
core entities: **Clients** (created by an admin/owner, each with its own
credentials and an allowed-scopes ceiling) and **Users** (resource owners
registered under one specific client, inheriting that client's full scope
set). It supports three grants — Client Credentials, Resource Owner
Password Credentials, and Refresh Token — exposed entirely through its
own API surface, with `oidc-provider` used internally as the underlying
protocol engine rather than mounted directly. Access tokens are signed
JWTs, verifiable by other services offline via a published public key,
rather than opaque strings requiring a callback to this server. Because
it is a teaching/reference project, requirements cite the RFC 6749
section they implement.

## Repositories involved

| Repository | Role |
|---|---|
| oauth | Owns the entire feature: client management, resource owner signup, the RFC 6749 token endpoint (client credentials, resource owner password credentials, refresh token grants), and scope enforcement. Built with NestJS wrapping the `oidc-provider` library internally as the OAuth2/OIDC engine, but exposing its own custom API surface rather than `oidc-provider`'s default routes. Organized into modules that connect directly to their underlying technologies — no hexagonal ports/adapters layer, unlike the sibling `nest-hexagonal` template it borrows its module-splitting convention from (that repo is a style reference only; it is not itself modified). |

## Requirements

### REQ-1: Client management

Not part of RFC 6749 itself (the RFC treats client registration as
out-of-band), but required here because clients are created through the
app rather than pre-configured.

- REQ-1.1: An authenticated admin/owner can register a new client by
  providing a client name and an allowed-scopes list.
- REQ-1.2: On registration, the system generates and returns a unique
  `client_id` and `client_secret` for that client.
- REQ-1.3: An unauthenticated caller, or one without admin/owner
  standing, cannot create a client.

### REQ-2: Resource owner registration (signup)

Also not part of RFC 6749 (the RFC assumes resource owner authentication
already exists) but required here because this server owns that role.

- REQ-2.1: A prospective resource owner registers under one specific
  client by providing that client's identifier, a username or email, and
  a password.
- REQ-2.2: Registration is rejected if the username/email is already
  registered under that same client. The same username/email may exist
  as a separate, unrelated user under a different client.
- REQ-2.3: A successful registration response never echoes back the
  password or any derived secret.
- REQ-2.4: Each resource owner inherits their client's full allowed-scopes
  list (REQ-1.1) in its entirety — there is no separate per-user scope
  assignment, and a resource owner's effective scopes always reflect the
  client's *current* allowed-scopes list, not a snapshot taken at signup.

### REQ-3: Resource Owner Password Credentials grant (RFC 6749 §4.3)

- REQ-3.1: A client can obtain an access token on behalf of one of its
  own users by submitting that user's username and password, together
  with the client's own credentials, using `grant_type=password`.
- REQ-3.2: A username/password combination only authenticates against
  the client that user is registered under (REQ-2.1) — the same
  credentials do not authenticate under a different client.
- REQ-3.3: An invalid username/password, or a user not belonging to the
  authenticating client, returns the RFC 6749 §5.2 `invalid_grant` error
  and issues no token.
- REQ-3.4: A successful response includes an access token and a refresh
  token (RFC 6749 §4.3.3), scoped per REQ-6.

### REQ-4: Client Credentials grant (RFC 6749 §4.4)

- REQ-4.1: A registered client can obtain an access token using its own
  `client_id`/`client_secret` with `grant_type=client_credentials`.
- REQ-4.2: Unknown or invalid client credentials return the RFC 6749
  §5.2 `invalid_client` error and issue no token.
- REQ-4.3: A Client Credentials grant response never includes a refresh
  token, per RFC 6749 §4.4.3.
- REQ-4.4: A Client Credentials token is scoped per REQ-6, using the
  client's own allowed-scopes list (REQ-1.1) as the ceiling — there is no
  user in this grant.

### REQ-5: Refresh Token grant (RFC 6749 §6)

- REQ-5.1: A client holding a valid, unexpired, unrevoked refresh token
  can exchange it for a new access token with `grant_type=refresh_token`.
- REQ-5.2: An invalid, expired, or revoked refresh token returns the RFC
  6749 §5.2 `invalid_grant` error and issues no token.
- REQ-5.3: A refresh request may narrow but never widen the original
  grant's scope, per RFC 6749 §6.
- REQ-5.4: Using a refresh token issues a new refresh token and
  immediately invalidates the one that was used (rotation). A repeated
  attempt to reuse an already-consumed refresh token is rejected the same
  way as REQ-5.2.

### REQ-6: Scope handling (RFC 6749 §3.3)

- REQ-6.1: A grant request (REQ-3, REQ-4) may include a `scope`
  parameter listing the specific scopes requested.
- REQ-6.2: If `scope` is omitted, the full set of scopes assigned to the
  caller is granted — the client's allowed-scopes list (REQ-1.1), whether
  the caller is the client itself (REQ-4) or one of its users, who
  inherit that same list in full (REQ-2.4).
- REQ-6.3: If `scope` requests anything outside what's assigned to the
  caller, the request is rejected with the RFC 6749 §5.2 `invalid_scope`
  error and issues no token.
- REQ-6.4: An issued access token's effective permissions are exactly
  its granted scope set — nothing outside it is usable.

### REQ-7: Token issuance format (RFC 6749 §5.1)

- REQ-7.1: Every successful grant response includes `access_token`,
  `token_type`, and `expires_in`.
- REQ-7.2: Access tokens have a bounded, finite lifetime, after which
  they are no longer accepted.
- REQ-7.3: A successful grant response includes the granted `scope` when
  it differs from what was requested, per RFC 6749 §5.1.

### REQ-8: Token endpoint error responses (RFC 6749 §5.2)

- REQ-8.1: A malformed request or missing required parameter returns
  `invalid_request`.
- REQ-8.2: A `grant_type` value this server does not support returns
  `unsupported_grant_type`.
- REQ-8.3: Every error response follows the RFC 6749 §5.2 error object
  shape (`error`, optional `error_description`).

### REQ-9: Token integrity (signed access tokens)

Not part of RFC 6749 (which doesn't mandate any particular access token
format), but required here so a token can be verified by another service
without that service calling back to this one.

- REQ-9.1: Access tokens are issued as signed JWTs, signed with an
  asymmetric key pair this server alone holds the private half of — any
  holder can verify a token's authenticity and integrity offline.
- REQ-9.2: The public key needed to verify a token's signature is
  published at a stable, well-known location.
- REQ-9.3: Refresh tokens remain opaque values, not signed JWTs — only
  access tokens carry a verifiable signature.

## Failure modes

- Malformed request body or missing required parameter → `invalid_request`
  (REQ-8.1), no partial state change.
- Unknown/unsupported `grant_type` → `unsupported_grant_type` (REQ-8.2).
- Requested scope exceeds the caller's assigned scopes → `invalid_scope`
  (REQ-6.3), no partial grant.
- Underlying data store unavailable during token issuance, client
  creation, or signup → the request fails without issuing a token or
  creating a partial client/account; exact response shape is a design.md
  decision.
- Two concurrent signups race for the same username/email under the same
  client → exactly one succeeds; the other observes the REQ-2.2 duplicate
  rejection, not a server error.

## Non-goals

- Authorization Code grant and Implicit grant (RFC 6749 §4.1, §4.2) —
  both require a redirect-based consent UI, which is explicitly out of
  scope.
- A resource owner consent/login UI — this is an API/protocol-only
  implementation.
- Acting as a Resource Server (validating tokens to serve protected
  business APIs) — this repo only issues and manages tokens.
- Acting as an OAuth Client — this repo is the authorization server, not
  a consumer of another authorization server.
- Third-party/social login (e.g. Google, GitHub) — only this server's own
  username/password accounts are supported.
- Organization-level multi-tenancy (per-tenant billing, isolated admin
  roles, tenant-specific configuration) — Users are segregated per
  Client (REQ-2), but that's the only isolation this spec provides;
  there's no broader tenant/org management layer on top of it.
- Password reset and email verification flows — explicitly deferred
  past this spec.
- Brute-force/lockout protection on failed authentication attempts —
  explicitly deferred past this spec.
- Per-resource, audience-restricted tokens (true RFC 8707 resource
  indicators, with multiple registered resource servers each getting
  differently-scoped tokens) — every access token is signed the same way
  regardless of which downstream service will consume it (REQ-9); there
  is only one implicit audience for now.
- A token introspection endpoint (RFC 7662) — REQ-9's signed, offline-
  verifiable access tokens serve the purpose an introspection endpoint
  would otherwise exist for.

## Open questions

- **Signing key rotation.** REQ-9.1's key pair lives in a dedicated
  secrets layer (see design.md), which settles *where* it's stored, but
  not whether/how the key itself is ever rotated (a new key pair issued,
  old tokens still verifiable against the retired key until they expire,
  etc.) — that's still unaddressed.
- **Password complexity: none, by design.** Resolved — signup only
  requires a non-empty password string; no complexity policy. Recorded
  here so it reads as a decision, not an oversight.

Resolved during design review (no longer open): admin/owner identity
(REQ-1.3) is a static credential checked against an environment
variable; user scope assignment (REQ-2.4) is full inheritance from the
client, not a per-user subset; refresh tokens rotate on every use
(REQ-5.4); `oidc-provider`'s OIDC-specific machinery (ID tokens,
discovery, `/userinfo`) is neither used nor actively suppressed — just
left alone; token introspection is superseded by REQ-9's signed,
self-verifiable access tokens; REQ-9.1's private/public key pair is
held by a dedicated secrets layer, and REQ-9.2's "stable, well-known
location" is how the public half reaches consumers like a frontend that
wants to verify a token's origin itself.
