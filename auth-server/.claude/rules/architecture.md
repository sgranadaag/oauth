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

## Three layers

`src/` has exactly three folders plus the two root files. Which one a
file belongs in is decided by **what the file is**, never by what uses
it:

```
src/
  main.ts                   bootstrap: pipes, Swagger, listen
  app.module.ts             a list of features — no setup
  core/                     plumbing that runs once
  common/                   shared, stateless, domain-free
  modules/                  everything that knows what this server does
```

- **`core/`** is wiring: configuration, the database connection, global
  middleware, and the signing-key files. `core.module.ts` gathers it, and
  `AppModule` imports that one module. Global filters, pipes and
  interceptors belong here as they appear.
- **`common/`** holds no state and declares no `@Module` — guards,
  decorators, pure helpers, and the types those need. **A file belongs
  here only if it would make sense, unchanged, in a server that had
  nothing to do with OAuth.** That test is what moved signing, key
  handling and password hashing out of it.
- **`modules/`** is the only layer that knows the domain.

Three aliases, one per layer: `@core/*`, `@common/*`, `@modules/*`. Use
them for every cross-folder import; relative paths only inside the same
folder. Each `tsconfig.json` path starts with `./` — without a
`baseUrl`, a bare `src/...` makes TypeScript reject the alias, and the
editor then rewrites every unresolved import into a relative path.

**Dependencies run one way**: `modules → common`, `modules → core`,
never back. A util that needs a module's type is in the wrong folder.

## The modules, and what each owns

```
modules/
  client/          registered clients and their policy
  user/            the accounts — the identity side
  oauth/           the protocol (RFC 6749 / OIDC)
    code/          authorization requests and one-time codes
    token/         minting, storing and rotating tokens; the signing keys
    grant/         one service per grant_type, plus the registry
    scope/         the scope policy
```

| Module | Owns | Exports | Reached by |
| --- | --- | --- | --- |
| `client` | `clients`, the secret, `redirectUris`, `allowedScopes`, `grantTypes`, `accessTokenTtlSeconds` | `ClientRepository` | `POST /clients`; `oauth` and `BasicTokenGuard` read it |
| `user` | `users`, bcrypt hashes | **nothing** | `POST /users/signup`, `POST /users/verify` — over HTTP only |
| `oauth` | `/authorize`, the interaction endpoints, `/token` dispatch, `/revoke`, `/jwks`, the RFC 6749 §5.2 error body | nothing | the browser, the login app, the client |
| `oauth/code` | `authorization_requests`, `authorization_codes`, their single-use lifecycle | `CodeService` | `oauth`, `grant` |
| `oauth/token` | `tokens`, rotation, sessions with a fixed end, JWT signing, the key files | `TokenService`, `TokenRepository` | `oauth`, `grant` |
| `oauth/grant` | one handler per `grant_type` | every handler | `oauth`, by `ModuleRef` |
| `oauth/scope` | `narrow(granted, requested)` | `ScopeService` | `oauth`, `grant` |

Two boundaries carry most of the design:

- **`oauth` decides; the others store and mint.** Whether a request is
  valid OAuth — the redirect URI, PKCE, the scope, when an ID token is
  owed — is decided in `oauth`. `code` stores and expires what it is
  handed; `token` mints what it is told to; neither knows a grant.
- **`user/` is a neighbour, not a dependency.** It exports nothing and
  `oauth` never imports it. The login app asks `/users/verify` over HTTP
  and then tells `oauth` who signed in. Two roles in one process —
  **don't wire them together**, even though a direct call would compile.

## Where a file goes inside a module

```
modules/client/
  client.module.ts
  client.controller.ts
  client.service.ts             one class per module, one method per action
  client.repository.ts          concrete class wrapping the TypeORM repository
  client.entity.ts              the only entity, so no entities/ folder
  client.constants.ts
  client.swagger.ts
  interfaces/                   always a folder, whatever the count
    createClient.interface.ts
  dto/                          always a folder, whatever the count
    createClient.dto.ts
    clientResponse.dto.ts
```

**`dto/` and `interfaces/` are always folders**, even holding one file.
They are the module's contracts — what a caller sends and gets back, and
the shapes the module works in — and those are worth a fixed place to
look, the same in every module, without counting files first.

**Everything else earns a folder at the second file.** One entity stays
`client.entity.ts`; two become `entities/`, as in `oauth/code/`. One util
is `<module>.util.ts` (`user.util.ts`); several go to `utils/` named by
subject (`token/utils/jwt.util.ts`, `keys.util.ts`). The suffix already
says what a file is, so a folder around a lone one adds nesting and says
nothing new. The rule runs both ways: **when the second file appears,
move both in.**

Subfolders are for one *kind* of file — `entities/`, `interfaces/`,
`dto/`, `services/`, `utils/` — **never for layering**. No
`domain/`, `application/` or `infrastructure/`, and nothing separating
"the service layer" from "the repository layer": that is the split this
architecture deliberately removed.

Constants go in **one** `<name>.constants.ts` per module, not a file per
value.

## Nested modules

**A module whose only caller is another module lives inside it.** The
four under `oauth/` are there because nothing else imports them and
`app.module.ts` registers `OauthModule` alone. Nesting is only *where*
they live: each keeps its own `@Module`, entities, repository and
constants, and the dependency still points one way — `oauth` may import
them, they may never import `oauth`. A nested module that grows a second
caller moves back up to `modules/`. `client/` and `user/` stay at the top
because they are reachable on their own.

Two wiring consequences, both easy to get wrong:

- **`ModuleRef.get()` needs `{ strict: false }`** to reach a nested
  module's provider, because a strict lookup searches only the host
  module. `OauthService` resolves grant handlers this way. Without it the
  token endpoint fails at request time, not at build time.
- **A shared provider cannot live in the parent.** `ScopeService` is
  needed by `OauthService` and by two grants, and `OauthModule` imports
  `GrantModule`; providing it in `OauthModule` and exporting it to
  `GrantModule` would close a cycle that Nest rejects at boot. Hence
  `scope/` as its own module rather than a `forwardRef`.

## An open-ended set is a nested module

`oauth/grant/` is the shape to copy when a set of interchangeable
implementations grows over time:

```
oauth/grant/
  grant.module.ts            provides and exports every member
  grant.constants.ts         one name per grant, plus SUPPORTED_GRANT_TYPES
  grant.registry.ts          the set, as data: name -> service
  interfaces/
    grant.interface.ts       GrantHandler, the registration, each grant's params
  services/
    authorizationCodeGrant.service.ts
    clientCredentialsGrant.service.ts
    refreshTokenGrant.service.ts
```

Everything outside `services/` is what every member shares. **Adding a
grant touches three files in this folder and nothing above it**: its own
service, the name in `grant.constants.ts`, and the registry entry.
`grant.module.ts` derives its providers from the registry, so it is never
edited.

**The rest of the app imports `grant.constants.ts`, never the registry.**
`CreateClientDto` validates against `SUPPORTED_GRANT_TYPES` — three
strings. Importing the registry instead would pull every grant handler,
and with them `CodeService` and `TokenService`, into the client module's
import graph for the sake of one `@IsIn`. The cost is that the constant
list and the registry are extended together; they sit a few lines apart
so an omission is visible.

## Where a type goes

**Every type is declared in a file of its own**, named
`<subject>.interface.ts`, and imported — never left inline in the file
that happens to use it. This holds even for a type read by exactly one
file: a grant's param shape is declared, not local.

The test, in order:

1. **Is it used by a shared layer — a guard, a decorator, a middleware?**
   → `common/interfaces/`. Only two qualify today:
   `swaggerDocs.interface.ts` (the contract `@SwaggerDocs` and every
   `<module>.swagger.ts` agree on) and `authenticatedRequest.interface.ts`
   (what a guard writes onto the request and a controller reads back).
   An app-wide error shape would join them.
2. **Otherwise, which module owns it?** → that module's
   `interfaces/<subject>.interface.ts`.

There is no third answer. **A type follows its consumer**, not its
subject matter: `accessToken`, `idToken` and `jwks` sat in `common/`
while `jwt.util` and `keys.util` did, and moved into
`oauth/token/interfaces/` with them. What a module owns — a service's
result, a grant's params, the token request and response bodies, the
claims a token carries, who signed in — stays in that module.

Note what does *not* qualify as app-wide: the RFC 6749 §5.2 error body is
the token endpoint's contract, so `OauthException` stays inside `oauth`.
A shape one module owes its callers is that module's; a shape this app
defines for itself is everyone's.

## Persistence, repositories and services


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

## The oauth module

**The protocol lives in one module, and nothing outside it knows the
protocol exists.** `modules/oauth/` owns both endpoints of RFC 6749 —
authorization (`GET /oauth/authorize` and the interaction endpoints the
login app calls) and token (`POST /oauth/token`, dispatched by
`grant_type`) — plus `/revoke`, `/jwks`, the scope policy and the
RFC 6749 §5.2 error body (`oauth.exception.ts`).

It depends on `client/` and on its own four nested modules, and on
**nothing in `user/`** — the identity side, which is a second role
sharing one process and is reached over HTTP by the login app like any
other caller. `UserModule` exports nothing so the two cannot be wired
together by accident. The direction never reverses: a module that needs
something from `oauth` has its responsibility in the wrong place.

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
- **`src/modules/oauth/code/` stores the two short-lived documents of
  the code flow**: a validated request waiting for sign-in
  (`CodeRequestEntity`, collection `authorization_requests`, keyed by the
  `interaction` id the sign-in page receives) and the one-time code it
  turns into (`CodeEntity`, collection `authorization_codes`, keyed by the
  code value). It owns their lifecycle — creation, expiry, single use —
  and decides nothing about OAuth. Its one repository serves both
  collections, because the two are stages of one flow and never read
  apart. **The collection names keep the protocol's wording** while the
  module is named for what it holds; renaming them is a data migration,
  and this repo has none.
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
- **Minting tokens is `src/modules/oauth/token/`, and it is
  protocol-free.**
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
  `grant/services/`, an `@Injectable()` implementing `GrantHandler`
  — a single `handle(client, params)` returning `IssuedTokens`.

  **Registration is data, not code.** `grant/grant.registry.ts`
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
  top-level `src/common/guards/` layer, including ones that depend on a
  module's repository. See Cross-cutting code below for how their DI
  registration works.
- File naming is `camelCase.role.ts` throughout.

## Swagger schemas

**Every documented handler carries exactly one Swagger decorator:**
`@SwaggerDocs(<MODULE>_SWAGGER.<ENDPOINT>)`, from
`@common/decorators/swaggerDocs.decorator`. Don't reach for `@ApiOperation`,
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

## Infrastructure modules live in `core/`

A Nest module that is **not part of the domain** — infrastructure that
takes configuration and offers a capability back, such as a connection,
a transport or a client for something external — goes in
`src/core/<name>/`, not in `src/modules/`. It owns no entity, no
business rule and no state of its own; whatever it holds belongs to the
caller.

The test: **would this module still make sense, unchanged, in a product
that has nothing to do with OAuth?** Yes → `core/`. It names a concept
this server owns (client, code, token, oauth, user) → `modules/`.

`core/database/` is the one that exists: `DatabaseModule` opens the
connection with `mongoConfig`, and entities reach it through
`TypeOrmModule.forFeature` in their own module — never by being listed
there. `autoLoadEntities` picks up whatever has been registered, so
adding an entity touches only its module.

**Everything in `core/` is imported exactly once, by `CoreModule`**,
which `AppModule` imports and nothing else does. That is what keeps
`app.module.ts` a list of features instead of a setup script. A module
that has to be injectable everywhere carries `@Global()` rather than
being imported again in each consumer. It decides nothing about what is
stored: the module that owns the data writes its own repository over
what the infrastructure module provides. Construction config lives in
`core/config/` or beside the module it configures
(`core/database/mongo.config.ts`) — the module is where the wiring
lives, not where the settings are decided.

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

Code with no per-module home is split **by kind**, into one folder per
kind under `common/` or `core/` — never tipped into a single
general-purpose bucket. `common/` is the address, not the excuse: a file
lands there because it is shared, stateless and domain-free, and it goes
into the folder named for what it is.

- `src/common/guards/` — **every** route-level allow/deny guard, without
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
- `src/common/decorators/` — composed decorators, one `<name>.decorator.ts` per
  subject. One today:
  - `swaggerDocs.decorator.ts` — `SwaggerDocs(schema, responseType?)`,
    built with Nest's `applyDecorators`. It replaces the five-to-seven
    `@Api*` decorators every handler used to stack with a single
    `@SwaggerDocs(OAUTH_SWAGGER.TOKEN)`, reading which decorators to
    apply off the schema's own keys. See "Swagger schemas" below for the
    schema shape and why `responseType` is a separate argument.
- `src/core/middlewares/` — request-level Express/Nest middleware, distinct
  from guards: it runs before routing and decides nothing about access.
  One today:
  - `requestLogger.middleware.ts` — a line per request on
    `response.finish`, wired up in `AppModule.configure()`. **It logs no
    request body and no `Authorization` header**, because on this server
    those are credentials — see `src/core/middlewares/README.md` for exactly
    what it is allowed to touch, and keep that property if you extend
    it.
- `src/common/utils/` — **three files, grouped by kind rather than by
  subject**: `crypto`, `date`, `http`. A new helper joins the file for
  its kind; a new file means a genuinely new kind, not a new subject.
  That is what stopped `random`, `pkce`, `string` and `password` from
  being four one-function files that each looked like the natural home
  for the next helper.

  **A util only belongs here when it carries no domain knowledge.**
  Signing and key handling used to sit here and didn't qualify — they
  exist to mint this server's tokens, so they moved to
  `oauth/token/utils/` (see below). What is left would make sense,
  unchanged, in any server.
  - `crypto.util.ts` — every cryptographic primitive that carries no
    domain knowledge. Each one is the **only** of its kind in the
    codebase:
    - `createRandomValue(byteLength)` — the only way a bearer value is
      generated (authorization request ids, codes, refresh tokens):
      CSPRNG bytes, base64url-encoded. The byte length is a constant of
      the module that owns the value.
    - `sha256Base64Url(value)` — today the PKCE `code_challenge`
      (RFC 7636 §4.2). It reads its input as **ASCII**, which the RFC
      requires and a caller hashing anything else would not expect.
    - `constantTimeEquals(value, expected)` — the only constant-time
      comparison: every value an attacker submits the guess for goes
      through it, today the plaintext client secret in `BasicTokenGuard`
      and the provider key in `AdminGuard`. Don't hand-roll a
      `timingSafeEqual` beside a length check again — that is how two
      copies drift.

  Password hashing is **not** here. `hashPassword`, `verifyPassword` and
  `DUMMY_PASSWORD_HASH` live in `modules/user/user.util.ts`, with
  `SALT_ROUNDS`: bcrypt is the identity side's, `UserService` is their
  only caller, and nothing in `oauth` has any business with them. Keeping
  them in a shared folder made that look like a capability anyone could
  reach for.
  - `http.util.ts` — the request and response shapes this server speaks,
    as plain strings: no framework type crosses into it.
    - `buildUrl(baseUrl, params)` — how **every** redirect this server
      sends is built: back to a client with a `code` and `state`, back to
      it with an `error`, on to the login page with an `interaction` id.
      An `undefined` value is left out rather than written as the string
      `"undefined"`, so an optional parameter needs no decision at the
      call site.
    - `decodeBasicAuth(header)` — the **only** place an
      `Authorization: Basic` header is taken apart, shared by
      `BasicTokenGuard` and the request logger. It splits on the
      **first** colon, so a secret containing one survives, and it
      decides nothing: a missing header, a non-Basic scheme and a
      colon-less payload all come back `null`.
  - `date.util.ts` — `secondsFromNow(seconds)` for storing an expiry and
    `isExpired(expiresAt)` for checking one. Every short-lived document
    goes through both, so "expired at the boundary" means the same thing
    everywhere.
- `src/modules/oauth/token/utils/` — the two that are boundaries rather
  than helpers. They live in the token module because the key material
  exists to sign this server's tokens; only `getPublicJwks()` is reached
  from outside it, by `oauth.service.ts` for `GET /oauth/jwks`.
  - `keys.util.ts` — the **only** place the signing key files are read,
    from `src/core/secrets/` (the PEMs are a deployment artifact, which
    is why they sit in `core/` while the code reading them does not).
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

  `src/core/secrets/` holds only the two PEM files — there is no second key
  format on disk to drift.
- `src/core/config/` — construction/configuration functions that take their
  dependencies and return a config object: `mongoConfig` for TypeORM.
  Config decisions live
  here, not inside the thing being configured.
- `src/core/config/env.config.ts` — env-var *names* only (the `ENV` object).
  Anything a module owns goes in that module's own `<name>.constants.ts`
  instead.
- `src/common/interfaces/` — the general configuration, guard and error
  contracts described under Module shape above. These layers do **not**
  keep their own interface files; a type
  a guard and a util both need is shared by definition, so it goes here.
  `swaggerDocs.interface.ts` lives here for the same reason: the
  decorator layer and every module's `<module>.swagger.ts` have to agree
  on it.

Each is a flat, purpose-named folder. There are only three aliases and
adding a kind does **not** add a fourth: a new kind is a new folder
under `common/` or `core/`, reached through the alias those already
have.

When neither `core/` nor `common/` is obviously right, ask rather than
defaulting — that question usually means the file belongs to a module.

## Tests

There is no test layer in this project: it is a reference implementation
meant to be read and run, and the checks are the reader's. Do not add a
test framework, a suite or a coverage tool unless the user asks for one.
