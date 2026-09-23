---
description: Module structure and layering conventions for this repository
---

# Architecture

This structure was arrived at after two explicit reversals during the
original build (a "brief" flat ports/adapters split, then a full
`nest-hexagonal`-style `domain/application/infrastructure` layering with
ID value objects and port/token pairs for every use case and
repository — both tried, both superseded). **Treat what's below as a
settled decision, not a default to rediscover** — don't reintroduce
either of those patterns without the user explicitly asking for it.

## Module shape

Every feature module lives flat under `src/modules/<name>/` — singular
folder name, **no** `domain/`, `application/`, or `infrastructure/`
subfolders. `src/modules/` is for the domain only; a module that is
plumbing rather than a business concept goes in `src/global/`
instead (see Global modules below), with the same internal shape:

```
src/modules/client/
  client.entity.ts        # TypeORM entity — also the only "domain" model
  client.repository.ts    # concrete class wrapping Repository<ClientEntity>
  client.service.ts       # one class per module, one method per action
  client.controller.ts
  client.module.ts
  client.swagger.ts       # CLIENT_SWAGGER + CLIENT_PROPERTY_SWAGGER
  interfaces/
    createClient.interface.ts
  dto/
    createClient.dto.ts
    clientResponse.dto.ts
```

**A module owns its own interfaces and constants.** At the module root,
constants go in one `<name>.constants.ts` and interfaces in an
`interfaces/` folder — **not** a collected `<name>.interfaces.ts`, which
is the shape this replaced. (A subfolder is the one exception; see
below.) Create either only when there is something to put in it
(`oauth.constants.ts` holds the token type and the RFC 6749 error codes;
`token.constants.ts` holds the issuer, audience and token lifetimes).

**Every interface and type a module needs lives in
`<module>/interfaces/`, split by responsibility** — one file per
subject, named `<subject>.interface.ts` (singular, matching
`src/interfaces/`), holding the types that belong to that subject. The
oauth module root has two, one per endpoint: `tokenEndpoint.interface.ts`
(`TokenRequestParams`, `TokenResponse`) for `POST /oauth/token`, and
`authorizeEndpoint.interface.ts` (`AuthorizeQuery`, `InteractionDetails`,
`InteractionAcceptResult`) for the front channel.

This holds **even for a type used by exactly one file**: a grant's own
param shape is declared in `interfaces/` and imported, not left local to
the service. The split is by subject, not by
consumer count — when a new subject appears, add a file rather than
growing an existing one past what its name covers.

**`src/interfaces/` is for the app's general, cross-cutting contracts**
— how the application is wired and documented, never what it does for a
user. Same file naming as a module's own folder
(`<subject>.interface.ts`), so only the location says who owns the type.
Three kinds live here:

- **General configuration and documentation shapes** —
  `swaggerDocs.interface.ts` (`SwaggerEndpointSchema`), the contract the
  `@SwaggerDocs` decorator and *every* module's `<module>.swagger.ts`
  have to agree on. Transport, database and similar setup contracts
  belong here too as they appear.
- **Guard contracts** — `authenticatedRequest.interface.ts`
  (`BasicTokenRequest`): what a guard writes onto
  the request and a controller reads back off it. A guard is a layer, not
  a module, so its types cannot live in a module's folder.
- **Error shapes**, once an app-wide one exists — the contract every
  layer formats or catches errors with. Note what does *not* qualify:
  the RFC 6749 §5.2 body is the *token endpoint's* contract, not the
  app's, so `OauthException` and its codes stay inside the oauth
  module. A shape one module owes its callers is that module's; a shape
  this app defines for itself is everyone's.

Plus `accessToken.interface.ts` (`AccessTokenClaims` and its sign
options): the shape `@utils/jwt.util` signs, which whoever verifies the
token later has to agree on. It belongs to no module.

**Everything a module owns goes in that module instead**: the result of
a service method (`CreateClientResult`), a grant's param shape, the
token request and response bodies, who signed in
(`AuthenticatedUser`). These describe this
server's behaviour, and each has exactly one owner.

The test, in order:
1. **Is it about wiring, documenting or guarding the app, rather than
   about a business concept?** → `src/interfaces/`.
2. **Otherwise, which module owns it?** → that module's
   `interfaces/<subject>.interface.ts`.

There is no third answer: a type is never left declared inside the file
that happens to use it. When a type is used by two modules and belongs
to neither, that is the signal it is infrastructure — and that it
belongs in `src/interfaces/`.

Group a module's constants and DI tokens in **one** `<name>.constants.ts`
rather than a file per value. `token.constants.ts` holds
`DEFAULT_ISSUER`, `DEFAULT_AUDIENCE` and the token lifetimes — the
values every minted token carries and every verifier has to agree on;
`oauth.constants.ts` holds `TOKEN_TYPE` and the `OAUTH_ERRORS` codes.

**A module subfolder that is an open-ended set carries its own
constants and interfaces, as two flat files** —
`<folder>.constants.ts` and `<folder>.interfaces.ts`, beside a
`services/` folder holding the members themselves. No nested
`interfaces/` folder inside a subfolder: one more level of nesting buys
nothing at this size. `grantTypes/` is the shape:

```
grantTypes/
  grantTypes.constants.ts    # one name per grant
  grantTypes.interfaces.ts   # GrantHandler, GrantTypeRegistration, each grant's params
  grantTypes.registry.ts     # the set, as data
  services/
    authorizationCodeGrant.service.ts
    clientCredentialsGrant.service.ts
    refreshTokenGrant.service.ts
```

The three flat files are what every member shares; `services/` is the
open-ended part that grows. **Adding a grant touches that folder and
nothing above it.** The module root keeps what the module as a whole
shares, and reaches down when it needs something from the set —
`oauth.service.ts` imports the registry from there.

Subfolders inside a module are for **open-ended sets of one
responsibility**, not for layering. Three exist today: `interfaces/`,
`dto/`, and `grantTypes/` in the oauth module. Don't add one to separate "the service
layer" from "the repository layer" — that's the split this architecture
deliberately removed.

- **One entity class per aggregate, and it *is* the Mongo document.** No
  separate domain/persistence entity pair, no mapper. The store is
  MongoDB through TypeORM (`mongoConfig`), so an entity is
  `@Entity('<collection>')` with `@Column()` fields.
- **`_id` is Mongo's, `id` is ours.** Every entity declares
  `@ObjectIdColumn() _id: ObjectId` that no application code ever reads,
  and a separate `@Index({ unique: true }) @Column() id: string` holding
  a `randomUUID()`. This is not a stylistic double key: TypeORM coerces
  any value queried against the `@ObjectIdColumn` into an `ObjectId`, so
  a UUID cannot live there — while "ids are plain strings, with no value
  object" is a settled decision for this codebase. Foreign keys
  (`TokenEntity.clientId`, `TokenEntity.userId`) hold that same string —
  and `userId` is the `subject` the login app named, an id this server
  never looks up.
- **There are no relations.** TypeORM does not join on MongoDB, so a
  parent/child link is the id field and nothing more; a caller that
  wants the parent asks its repository. Constraints that a relational
  schema would express come from indexes instead: a token's `sessionId` is indexed because revoking a
  session deletes by it.
- **One database, one collection per entity**: `clients`, `tokens`,
  `authorization_requests`, `authorization_codes` and `users`. The last
  one belongs to the `user` module alone — **the oauth side must never
  query `users`**, even though the same connection would allow it. It
  learns about a person only from what the login app tells it at
  sign-in.
- **There are no migrations either.** Collections are schemaless, so
  `mongoConfig` sets `synchronize: true`, which on MongoDB only creates
  the declared indexes. Adding a field is nothing; adding a constraint
  means adding an `@Index`. A data backfill, when one is ever needed, is
  a script, not a migration.
- **One `<Name>Repository` class per module, injected by concrete
  class — no port/interface, no `Symbol` token.** A module that needs
  another module's repository (e.g. the refresh grant needing
  `TokenRepository`) gets it because the owning module exports the
  class itself from its `@Module()` `exports` array; Nest resolves a
  class as its own DI token, so nothing else is needed.
- **A repository is total over what the wire can send.** A lookup takes
  the id as it arrives — `undefined` included — and answers `null`
  rather than making its caller guard first: a Mongo filter built from an
  undefined value can end up empty and match the *first* document instead
  of none (`ClientRepository.findByClientId`). The guard belongs in the
  layer that builds the query, so no caller can forget it. **It stays a
  `null`, never a throw**: what "not found" means is the caller's to
  decide — a 400 without a redirect in `/authorize`, a 401 in
  `BasicTokenGuard`, a fallback display name in `interaction()`.
- **One `<Name>Service` class per module, not one class per use case.**
  Every action the module supports is a named method on that one class
  (`ClientService.create(...)`, and any future ones on the same class)
  — not a fresh `execute()`-only class (and inbound port) per action.
  Controllers inject the concrete service class directly.
- **DTOs and interfaces are the two things pulled into their own
  subfolders** (`dto/`, `interfaces/`) — kept apart from the
  entity/repository/service/controller files sitting next to them, even
  though everything else is flat.
- **The OAuth protocol lives in one module, `src/modules/oauth/`**, and
  nothing outside it knows the protocol exists. It owns both endpoints
  of RFC 6749 — authorization (`GET /oauth/authorize` and the interaction
  endpoints the login app calls) and token (`POST /oauth/token`, the
  dispatch by `grant_type`) — plus the scope policy
  (`scope.service.ts`), the RFC 6749 §5.2 error body
  (`oauth.exception.ts`) and one file per grant under `grantTypes/`. It
  depends on the domain modules (`client`, `authorization`, `token`) —
  but **not on `user/`, which is the identity side**: the accounts, their
  bcrypt hashes, `POST /users/signup` and `POST /users/verify`. It is a
  second role sharing one process, reached over HTTP by the login app
  like any other caller, and `UserModule` exports nothing so the two
  cannot be wired together by accident — **never the reverse** — a domain module that needs something
  from here has its responsibility in the wrong place.
- **What is about one client is registered on the client, not
  configured.** `ClientEntity` carries its `redirectUris`, its
  `allowedScopes`, its `grantTypes` (RFC 7591 — asking for one it does
  not hold is `unauthorized_client`, at `/authorize` and at `/token`) and
  its `accessTokenTtlSeconds` (`null` = the server default,
  `ACCESS_TOKEN_TTL_SECONDS`). Reach for a column before an environment
  variable: an env var makes the whole server do one thing, which is
  wrong the moment a second client needs another. The token module still
  knows no client — the grant reads the field and passes a number.
- **What is about an identity provider is configuration, not a client
  field.** `IDENTITY_PROVIDERS` in `oauth.constants.ts` maps the `idp`
  parameter of an authorization request to the environment variable
  holding that provider's sign-in page (`local` → `LOCAL_IDP_LOGIN_URL`).
  Adding a provider is one entry plus one variable; an unknown `idp` goes
  back to the client as `invalid_request`. A client does not own a login
  page: **which** identity is proved is the request's to say, **where**
  that happens is the provider's.
- **`/oauth/authorize` fails in two ways, on purpose.** While the client
  or its `redirect_uri` are unproven, errors are answered on the spot and
  the browser goes nowhere — redirecting to an unverified URL would make
  the endpoint an open redirector. Once both check out, every other error
  goes back to the `redirect_uri` as `error`, `error_description`,
  `state` (RFC 6749 §4.1.2.1). `redirect_uri` is compared by exact string
  match against `ClientEntity.redirectUris`; never relax that to a prefix.
- **`src/modules/authorization/` stores the two short-lived documents of
  the code flow**: a validated request waiting for sign-in
  (`authorization_requests`, keyed by the `interaction` id the sign-in
  page receives) and the one-time code it turns into
  (`authorization_codes`, keyed by the code value). It owns their
  lifecycle — creation, expiry, single use — and decides nothing about
  OAuth. Its one repository serves both collections, because the two are
  stages of one flow and never read apart.
- **Single use is a write, not a read.** A request is claimed by deleting
  it and a code is redeemed by an `updateOne` filtered on
  `consumedAt: null`; the caller whose write changed the document wins.
  A read-then-check would let two simultaneous submits both succeed. A
  code is spent before its checks run, so a stolen code tried with the
  wrong PKCE verifier is burned rather than left replayable.
- **ID tokens are owed only for `openid`.** The `authorization_code` grant
  asks `TokenService.issueIdToken` for one when the granted scope contains
  `openid`; the token module signs it (`aud` = `client_id`, `typ: JWT`,
  `nonce` echoed) without knowing the rule.
- **Who signed in is told to the oauth module, not checked by it.** The
  login app (`auth-front`'s server side) verifies the person against
  `/users/verify` and calls `POST /oauth/interactions/:id/accept` with
  `{ subject, email }`; `OauthService.acceptInteraction` believes it and
  issues the code. What makes that safe is `AdminGuard`: both interaction
  endpoints are behind the provider key, and **`accept` must never become
  reachable without it** — open, it would hand out codes for any user, no
  password asked. How a person proves who they are (a password today, MFA
  later) is the login app's and the `user` module's business and never
  reaches the oauth module.
- **`oauth` never calls `user`, though both live here.** The identity
  side vouches for a person once, at sign-in, through the login app; from
  there the session is the oauth side's to manage. A refresh checks only
  its own record, never whether the person still exists: **`UserModule`
  exports nothing, and `oauth` must not import it**. Wiring the two
  together would collapse a boundary that is a deployment decision, not a
  design one — today one process, tomorrow two.

  What bounds a session instead is its **fixed end**: `sessionExpiresAt`,
  set at sign-in to `SESSION_TTL_SECONDS` and copied unchanged onto every
  rotated token, whose own `expiresAt` is capped at it. Rotation renews
  the token, never the session, so the person is sent back through the
  login app — and vouched for again — at least that often.

  Ending a user's sessions *before* that end, once the identity side can
  delete or block users, is a revocation it **pushes** to this server
  (by `subject`, behind a key — not written yet), never a question this
  server asks.
- **Minting tokens is `src/modules/token/`, and it is protocol-free.**
  `TokenService.issue({ clientId, userId?, scope, sessionId?,
  sessionExpiresAt? })` signs
  the access token, stores a refresh token when there is a user, and
  returns `IssuedTokens` in its own vocabulary — no `access_token`, no
  `grant_type`, nothing from RFC 6749. `TokenRepository` and
  `TokenEntity` are its store. The module knows nothing about grants,
  clients or which scopes a caller may ask for: **it mints what it is
  told to**, which is what lets it be read, tested and reused without
  the protocol around it.

  The wire format is applied in exactly one place, `OauthService`'s
  mapping of `IssuedTokens` to the §5.1 body. A grant returning
  `access_token` keys, or `TokenService` throwing an `invalid_scope`,
  is that boundary leaking.
- **One `<name>Grant.service.ts` per grant**, in
  `grantTypes/services/`, an `@Injectable()` implementing `GrantHandler`
  — a single `handle(client, params)` returning `IssuedTokens`.

  **Registration is data, not code.** `grantTypes/grantTypes.registry.ts`
  exports `GRANT_TYPES: GrantTypeRegistration[]` — `{ type, service }`
  per grant. `OauthModule` turns every `service` into a provider and
  `OauthService` dispatches on `type`. **Adding a grant means writing its
  service and appending one entry; nothing else changes.** Because the
  handler set is only known at runtime, it is resolved through
  `ModuleRef` instead of a fixed `inject` list. A `grant_type` with no
  entry is `unsupported_grant_type`, which is also how the grants that
  aren't written yet answer.

- **A grant service owns only what makes its grant different: what
  the caller presents as proof** — a code and its PKCE verifier, a
  refresh token, or the client alone. `handle()` validates that proof —
  throwing an `OauthException` carrying `invalid_grant` when it fails —
  narrows the scope through `ScopeService`, and hands the result to
  `TokenService.issue(...)`. **Deciding what counts as proof stays in the
  grant**; a grant that signs its own token is a grant reimplementing
  `TokenService`.
- **No oauth endpoint takes a password.** A password is typed only on
  `auth-front`, and the only endpoint that reads one is `/users/verify`,
  which `auth-front`'s server side calls. The `password` grant (RFC 6749
  §4.3) was removed on purpose; don't bring it back unless the user asks.
- **Every grant narrows a ceiling, none may widen one.**
  `ScopeService.narrow(ceiling, requested)` is that rule, and the ceiling
  is the grant's to supply: the client's `allowedScopes` for most, and
  what the refresh token was issued for on a refresh. Scope policy is an
  OAuth question, which is why it is here and not in the token module.
  It stays a service rather than a function so `invalid_scope` is thrown
  in one place; it holds no repository, because the client arrives
  already loaded.
- **`BasicTokenGuard` attaches the whole `ClientEntity`, not an id.** It
  has to read that document to verify the secret, so anything needing
  `allowedScopes` downstream would otherwise read the same document a
  second time on every token request. `request.client` is authenticated
  state, never body input, and the client flows from the controller
  through `OauthService` into each grant. **It stops at the oauth
  module**: `TokenService` takes `clientId: string`, so the token module
  keeps knowing nothing about domain entities.
- **Every failure on the token endpoint is an `OauthException`**, which
  renders `{ error, error_description }` as RFC 6749 §5.2 requires
  instead of Nest's default body. Error codes live in
  `oauth.constants.ts`; a bare `BadRequestException` anywhere in this
  module is a bug, because a spec-conformant client cannot read it.
- **Guards never live inside a module** — every guard belongs to the
  top-level `src/guards/` layer, including ones that depend on a
  module's repository. See Cross-cutting code below for how their DI
  registration works.
- File naming is `camelCase.role.ts` throughout.

## Swagger schemas

**Every documented handler carries exactly one Swagger decorator:**
`@SwaggerDocs(<MODULE>_SWAGGER.<ENDPOINT>)`, from
`@decorators/swaggerDocs.decorator`. Don't reach for `@ApiOperation`,
`@ApiOkResponse`, `@ApiUnauthorizedResponse` and friends directly — the
stack of five-to-seven of them per handler is exactly what this
replaced. `@ApiTags(<MODULE>_SWAGGER.API_TAG)` stays on the controller
class, since it's per-controller rather than per-endpoint.

Each module keeps its schemas in `<module>.swagger.ts`, in two exports:

- `<MODULE>_SWAGGER` — `API_TAG`, then one entry per endpoint
  (`SIGNUP`, `DELETE`, `TOKEN`, …) shaped as `SwaggerEndpointSchema`:
  `operation`, optional `security` / `consumes` / `params` / `body`, and
  `responses` **keyed by HTTP status code**. The decorator emits each
  response as `@ApiResponse({ status, ... })`, which renders the same as
  the per-status helpers. Omit a key and its decorator simply isn't
  applied.
- `<MODULE>_PROPERTY_SWAGGER` — the `@ApiProperty` options each DTO
  field uses.

**`<module>.swagger.ts` imports no DTOs.** The response class is passed
as `SwaggerDocs`' second argument instead
(`@SwaggerDocs(CLIENT_SWAGGER.CREATE, ClientResponseDto)`), where it is
attached to the schema's 2xx entry. Naming it inside the schema would
close a cycle — the DTOs import `<MODULE>_PROPERTY_SWAGGER` back out of
that same file, so the half-initialised module would leave
`@ApiProperty` reading `undefined` at class-decoration time, at boot,
with no useful stack. Handlers with no response body (a 204) take one
argument.

## Global modules

`src/global/<name>/` holds the Nest modules that are **not part of the
domain**: infrastructure that takes configuration and offers a
capability back — a connection, a transport, a client for something
external. They own no entity, no business rule, and no state of their
own; whatever they hold belongs to the caller.

The test: **would this module still make sense, unchanged, in a product
that has nothing to do with OAuth?** Yes → `src/global/`. It names a
concept this server owns (client, authorization, token, oauth) →
`src/modules/`.

**None exists today.** The only one was the Redis connection, which
served the OTP grant and left with it. The folder and its `@global/*`
alias come back with the next such module.

**A global module is registered once, as a dynamic module, the way
`TypeOrmModule.forRootAsync` is** — `forRootAsync({ imports, inject,
useFactory })` in `AppModule`, taking the factory that builds its
options, with `@Global()` on the class so what it exports is injectable
anywhere without every consumer importing it. It decides nothing about
what is stored: the module that owns the data writes its own repository
over what the global module provides. Its construction config lives in
`src/config/` with everything else's — a global module is where the
wiring lives, not where the settings are decided.

## What this does *not* apply to

- **An external library's own contract is not a "port" to eliminate.**
  When a library defines an interface this codebase must implement, that
  interface is the library's, not ours, and stays as-is regardless of how
  far the internal port-elimination direction goes. (Nothing fits this
  today: `oidc-provider` was removed and the protocol is implemented
  here. It applies again the moment a library is adopted.)
- **DI tokens for bridging a third-party value are not the same problem
  as an internal port/token.** A `Symbol` token carrying a connection
  that has to be constructed once is not an interface standing in for a
  swappable implementation — so it is unaffected by "no ports/tokens for
  repositories or use cases."

## Cross-cutting code

Code with no per-module home is split into dedicated top-level layers
by *kind*, not lumped into one general-purpose `common/` folder:

- `src/guards/` — **every** route-level allow/deny guard, without
  exception. Three today:
  - `AdminGuard` — the `x-admin-key` provider credential
    (`ADMIN_API_KEY`), on `POST /clients`, both interaction endpoints and
    `/users/verify`: everything that is the provider talking to itself.
    Depends only on the global `ConfigService`, compares through
    `constantTimeEquals`, and answers **403** — never 401, which on
    `/users/verify` means wrong credentials.
  - `GrantTypeGuard` — may this client use the `grant_type` it sent?
    Only on `POST /oauth/token`, and only **after** `BasicTokenGuard`
    (`@UseGuards(BasicTokenGuard, GrantTypeGuard)`), since it reads the
    client that one put on the request. Denies with an `OauthException`
    (`unauthorized_client`), so the body stays RFC 6749 §5.2. A missing
    `grant_type` passes through — that is `invalid_request`, which
    `OauthService` answers. Whether the *server* supports the grant is a
    different question, and stays with the registry.

    **It cannot guard `/oauth/authorize`**, and that is the spec's doing,
    not an oversight: there the client is not authenticated by a guard
    (it arrives as `client_id` in the query) and an `unauthorized_client`
    has to be *redirected* to the client's `redirect_uri` (§4.1.2.1), not
    thrown — which needs the client and its redirect URI resolved first.
    `OauthService.authorize` does that check inline, with the same
    `DEFAULT_GRANT_TYPES` fallback.
  - `BasicTokenGuard` — authenticates a *client* via
    `Authorization: Basic base64(clientId:clientSecret)`, the same
    credential shape `POST /oauth/token` uses. Depends on
    `ClientRepository`.

  There is no bearer guard: nothing on this server is a protected
  resource. Verifying an access token is the job of whichever resource
  server accepts it, offline, against the public key.

  A guard depending on a module's repository does *not* move into that
  module — the layer holds the class, and the module whose controller
  uses it registers it as a provider (`OauthModule` lists
  `BasicTokenGuard`, and already imports `ClientModule` for the
  `ClientRepository` it needs). Guards that need only global providers
  (`AdminGuard`) need no registration at all — `@UseGuards(TheGuard)`
  is enough. Keeping the registration with the consumer is what lets the
  guards layer stay free of module-ownership questions.
- `src/decorators/` — composed decorators, one `<name>.decorator.ts` per
  subject. One today:
  - `swaggerDocs.decorator.ts` — `SwaggerDocs(schema, responseType?)`,
    built with Nest's `applyDecorators`. It replaces the five-to-seven
    `@Api*` decorators every handler used to stack with a single
    `@SwaggerDocs(OAUTH_SWAGGER.TOKEN)`, reading which decorators to
    apply off the schema's own keys. See "Swagger schemas" below for the
    schema shape and why `responseType` is a separate argument.
- `src/middlewares/` — request-level Express/Nest middleware, distinct
  from guards: it runs before routing and decides nothing about access.
  One today:
  - `requestLogger.middleware.ts` — a line per request on
    `response.finish`, wired up in `AppModule.configure()`. **It logs no
    request body and no `Authorization` header**, because on this server
    those are credentials — see `src/middlewares/README.md` for exactly
    what it is allowed to touch, and keep that property if you extend
    it.
- `src/utils/` — generic utilities, split by subject:
  - `keys.util.ts` — the **only** place the signing key files are read.
    Exposes `getPrivateKeyPem()`, `getPublicKeyPem()`,
    `getSigningKeyId()` (the `kid`: the key's RFC 7638 thumbprint) and
    `getPublicJwks()` (the JWK Set `GET /oauth/jwks` serves). All cache
    after first use. **The JWK Set is derived from `public.pem`, never
    from the private key** — so no private member can leak through it.
  - `jwt.util.ts` — the **only** place tokens are signed (access and ID
    tokens), via `jsonwebtoken` on the private PEM from `keys.util`, with
    `kid` in every header. Verification is not here: it belongs to
    whoever accepts the token — the client for its ID token, a resource
    server for access tokens — against `GET /oauth/jwks`.
  - `string.util.ts` — string helpers that aren't about one subject.
    `constantTimeEquals` is the **only** constant-time comparison in the
    codebase: every value an attacker submits the guess for goes through
    it, today the plaintext client secret in `BasicTokenGuard` and the
    provider key in `AdminGuard`. Don't hand-roll a `timingSafeEqual`
    beside a length check again — that is how two copies drift.
  - `random.util.ts` — `createRandomValue(byteLength)`, the **only** way a
    bearer value is generated (authorization request ids, codes, refresh
    tokens): CSPRNG bytes, base64url-encoded. The byte length is a
    constant of the module that owns the value.
  - `url.util.ts` — `buildUrl(baseUrl, params)`, how **every**
    redirect this server sends is built: back to a client with a `code`
    and `state`, back to it with an `error`, on to the login page with an
    `interaction` id. An `undefined` value is left out rather than
    written as the string `"undefined"`, so an optional parameter needs
    no decision at the call site.
  - `time.util.ts` — `secondsFromNow(seconds)` for storing an expiry and
    `isExpired(expiresAt)` for checking one. Every short-lived document
    goes through both, so "expired at the boundary" means the same thing
    everywhere.

  - `password.util.ts` — `hashPassword` and `verifyPassword`, bcrypt and
    the **only** place the cost factor is written down. It belongs to the
    identity side: `UserService` is its only caller, and nothing in
    `oauth` has any business with it.

  `src/secrets/` holds only the two PEM files — there is no second key
  format on disk to drift.
- `src/config/` — construction/configuration functions that take their
  dependencies and return a config object: `mongoConfig` for TypeORM.
  Config decisions live
  here, not inside the thing being configured.
- `src/constants/` — env-var *names* only (`environment.constant.ts`).
  Anything a module owns goes in that module's own `<name>.constants.ts`
  instead.
- `src/interfaces/` — the general configuration, guard and error
  contracts described under Module shape above. These layers do **not**
  keep their own interface files; a type
  a guard and a util both need is shared by definition, so it goes here.
  `swaggerDocs.interface.ts` lives here for the same reason: the
  decorator layer and every module's `<module>.swagger.ts` have to agree
  on it.

Each is a flat, purpose-named folder with its own path alias
(`@decorators/*`, `@guards/*`, `@middlewares/*`, `@utils/*`,
`@config/*`, `@constants/*`, `@interfaces/*` in `tsconfig.json`) — use
those aliases (and `@modules/*`) for all imports, no relative
`../../..` climbing across a module boundary. **Adding a layer means
adding its alias to `tsconfig.json`**, and the path has to start with
`./`: without a `baseUrl`, a bare `src/...` value makes TypeScript
reject the alias, and the editor then rewrites every import it failed to
resolve into a relative path. There is no `src/common/` — it held
only `guards/` before this split and was removed once that moved out;
don't recreate it as a catch-all for whatever doesn't have an obvious
layer yet, add or ask for a properly named one instead.

## Tests

There is no test layer in this project: it is a reference implementation
meant to be read and run, and the checks are the reader's. Do not add a
test framework, a suite or a coverage tool unless the user asks for one.
