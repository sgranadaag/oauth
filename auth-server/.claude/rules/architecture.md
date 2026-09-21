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
(`oauth.constants.ts` holds the issuer, audience, token lifetime and
error codes that module defines).

**Every interface and type a module needs lives in
`<module>/interfaces/`, split by responsibility** — one file per
subject, named `<subject>.interface.ts` (singular, matching
`src/interfaces/`), holding the types that belong to that subject. The
oauth module root has one: `token.interface.ts` (`TokenRequestParams`,
`IssueTokenInput`, `TokenResponse`).

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
  (`BasicTokenRequest`, `BearerTokenRequest`): what a guard writes onto
  the request and a controller reads back off it. A guard is a layer, not
  a module, so its types cannot live in a module's folder.
- **Error shapes**, once an app-wide one exists — the contract every
  layer formats or catches errors with. Note what does *not* qualify:
  the RFC 6749 §5.2 body is the *token endpoint's* contract, not the
  app's, so `OauthException` and its codes stay inside the oauth
  module. A shape one module owes its callers is that module's; a shape
  this app defines for itself is everyone's.

Plus `accessToken.interface.ts` (`AccessTokenClaims` and its sign/verify
options), which is the same case as the guards: produced by
`@utils/jwt.util`, consumed by `BearerTokenGuard` — two layers, no
module.

**Everything a module owns goes in that module instead**: the result of
a service method (`SignupResult`, `CreateClientResult`), a grant's param
shape, the token request and response bodies. These describe this
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
rather than a file per value. `oauth.constants.ts` holds
`DEFAULT_ISSUER`, `DEFAULT_AUDIENCE`, `ACCESS_TOKEN_TTL_SECONDS`,
`TOKEN_TYPE` and the `OAUTH_ERRORS` codes — the values a grant, the
token service and `BearerTokenGuard` all have to agree on.

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
    clientCredentialsGrant.service.ts
    passwordGrant.service.ts
    otpGrant.service.ts
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
  (`User.clientId`, `TokenEntity.userId`) hold that same string.
- **There are no relations.** TypeORM does not join on MongoDB, so a
  parent/child link is the id field and nothing more; a caller that
  wants the parent asks its repository. Constraints that a relational
  schema would express come from indexes instead — "one email per
  client" is `@Index(['clientId', 'email'], { unique: true })` on
  `UserEntity`.
- **There are no migrations either.** Collections are schemaless, so
  `mongoConfig` sets `synchronize: true`, which on MongoDB only creates
  the declared indexes. Adding a field is nothing; adding a constraint
  means adding an `@Index`. A data backfill, when one is ever needed, is
  a script, not a migration.
- **One `<Name>Repository` class per module, injected by concrete
  class — no port/interface, no `Symbol` token.** A module that needs
  another module's repository (e.g. `UserService` needing
  `ClientRepository`) gets it because the owning module exports the
  class itself from its `@Module()` `exports` array; Nest resolves a
  class as its own DI token, so nothing else is needed.
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
  nothing outside it knows the protocol exists. It owns the token
  endpoint (`oauth.controller.ts`), the dispatch by `grant_type`
  (`oauth.service.ts`), the scope policy (`scope.service.ts`), the RFC
  6749 §5.2 error body (`oauth.exception.ts`) and one file per grant
  under `grantTypes/`. It depends on the domain modules (`client`,
  `user`, `otp`, `token`); **never the reverse** — a domain module that
  needs something from here has its responsibility in the wrong place.
- **Minting tokens is `src/modules/token/`, and it is protocol-free.**
  `TokenService.issue({ clientId, userId?, scope, sessionId? })` signs
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
  — a single `handle(clientId, params)` returning `IssuedTokens` — with
  its unit test mirroring the path in
  `src/tests/oauth/grantTypes/services/`.

  **Registration is data, not code.** `grantTypes/grantTypes.registry.ts`
  exports `GRANT_TYPES: GrantTypeRegistration[]` — `{ type, service }`
  per grant. `OauthModule` turns every `service` into a provider and
  `OauthService` dispatches on `type`. **Adding a grant means writing its
  service and appending one entry; nothing else changes.** Because the
  handler set is only known at runtime, it is resolved through
  `ModuleRef` instead of a fixed `inject` list. A `grant_type` with no
  entry is `unsupported_grant_type`, which is also how the grants that
  aren't written yet answer.

- **A grant service owns only what makes its grant different: how the
  user proves who they are.** `handle()` reads the params, calls its own
  `authenticateUser(clientId, params)` — which throws an
  `OauthException` carrying `invalid_grant` when the proof fails —
  narrows the scope through `ScopeService`, and hands both to
  `TokenService.issue(...)`.
  **Authentication stays in the grant**, with whatever it needs injected
  directly (`UserRepository` and `verifyPassword` for password, plus
  `OtpRepository` for otp); it is not delegated to `UserService`. A
  grant that signs its own token, on the other hand, is a grant
  reimplementing `TokenService`.
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
(`@SwaggerDocs(USER_SWAGGER.LOGIN, LoginResponseDto)`), where it is
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
concept this server owns (client, user, oauth) → `src/modules/`.

One exists today:

- `redis/` — `RedisModule`, which manages the Redis connection and
  offers it under the `REDIS_CLIENT` symbol (`redis.constants.ts`),
  closing it on shutdown. It decides nothing about what is stored:
  **the module that owns the data writes its own repository over that
  client**, in its own module, exactly as it would over a TypeORM
  repository.

**A global module is registered once, as a dynamic module, the way
`TypeOrmModule.forRootAsync` is** — `RedisModule.forRootAsync({ imports,
inject, useFactory })` in `AppModule`, taking the factory that builds
its options. The class carries `@Global()`, so what it exports is
injectable anywhere without every module importing it — the same deal
`TypeOrmModule` gives repositories, and the reason a consumer like
`OtpModule` lists only its own providers.

Their construction config still lives in `src/config/` with everything
else's (`redisConfig` beside `postgresConfig`) — a
global module is where the wiring lives, not where the settings are
decided.
Import them through the `@global/*` alias.

## What this does *not* apply to

- **An external library's own contract is not a "port" to eliminate.**
  When a library defines an interface this codebase must implement, that
  interface is the library's, not ours, and stays as-is regardless of how
  far the internal port-elimination direction goes. (Nothing fits this
  today: `oidc-provider` was removed and the protocol is implemented
  here. It applies again the moment a library is adopted.)
- **DI tokens for bridging a third-party value are not the same problem
  as an internal port/token.** `REDIS_CLIENT` is a `Symbol` token
  carrying a connection that has to be constructed once, not an
  interface standing in for a swappable implementation — so it is
  unaffected by "no ports/tokens for repositories or use cases."

## Cross-cutting code

Code with no per-module home is split into dedicated top-level layers
by *kind*, not lumped into one general-purpose `common/` folder:

- `src/guards/` — **every** route-level allow/deny guard, without
  exception. Three today, one per credential shape:
  - `AdminGuard` — the `x-admin-key` bootstrap credential. Depends only
    on the global `ConfigService`.
  - `BasicTokenGuard` — authenticates a *client* via
    `Authorization: Basic base64(clientId:clientSecret)`, the same
    credential shape `POST /oauth/token` uses. Depends on
    `ClientRepository`.
  - `BearerTokenGuard` — authenticates a caller by an access token this
    server issued (`Authorization: Bearer <jwt>`). Parses the header and
    attaches the decoded claims to `request.token`; all crypto is
    delegated to `@utils/jwt.util`. Depends only on `ConfigService`.

    **It stays offline — no database read, nothing consulted.** A token
    cannot be withdrawn before its `exp`; see the coding-standards rule
    for why that's the accepted trade-off and not a gap to close with a
    denylist lookup.

  A guard depending on a module's repository does *not* move into that
  module — the layer holds the class, and the module whose controller
  uses it registers it as a provider (`UserModule` lists
  `BasicTokenGuard`, and already imports `ClientModule` for the
  `ClientRepository` it needs). Guards that need only global providers
  (`AdminGuard`, `BearerTokenGuard`) need no registration at all —
  `@UseGuards(TheGuard)` is enough. Keeping the registration with the
  consumer is what lets the guards layer stay free of module-ownership
  questions.
- `src/decorators/` — composed decorators, one `<name>.decorator.ts` per
  subject. One today:
  - `swaggerDocs.decorator.ts` — `SwaggerDocs(schema, responseType?)`,
    built with Nest's `applyDecorators`. It replaces the five-to-seven
    `@Api*` decorators every handler used to stack with a single
    `@SwaggerDocs(USER_SWAGGER.LOGIN)`, reading which decorators to
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
    Exposes `getPrivateKeyPem()`, `getPublicKeyPem()`, and
    `getSigningJwks()` (which derives the JWK Set from the PEM, in
    memory, for a JWKS endpoint that does not exist yet). All three
    cache after first read.
  - `jwt.util.ts` — the **only** place access tokens are signed and
    verified, via `jsonwebtoken` on the PEMs from `keys.util`. Do not
    verify a token anywhere else; guards call `verifyAccessToken()`.
  - `string.util.ts` — string helpers that aren't about one subject.
    `constantTimeEquals` is the **only** constant-time comparison in the
    codebase: every value an attacker submits the guess for goes through
    it, the plaintext client secret in `BasicTokenGuard` and the
    one-time password in `OtpGrantService`. Don't hand-roll a
    `timingSafeEqual` beside a length check again — that is how two
    copies drift.
  - `password.util.ts` — the **only** place a user password is hashed or
    checked (`hashPassword`, `verifyPassword`), and the only place the
    bcrypt cost factor is written down. `UserService` and
    `PasswordGrantService` both call it; don't import `bcryptjs`
    anywhere else in `src/modules/`, or the two paths can drift on cost
    or comparison. Tests are the one exception — they hash fixtures at
    cost 4 directly, because cost 12 is ~600ms a call and a fixture
    doesn't need the work factor.

  `src/secrets/` holds only the two PEM files — there is no second key
  format on disk to drift.
- `src/config/` — construction/configuration functions that take their
  dependencies and return a config object: `postgresConfig` for TypeORM,
  `redisConfig` for the Redis connection. Config decisions live
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
`@config/*`, `@constants/*`, `@interfaces/*`, `@global/*` in `tsconfig.json`,
mirrored in `package.json`'s and `test/jest-e2e.json`'s Jest
`moduleNameMapper`) — use those aliases (and `@modules/*`, `@tests/*`)
for all imports, no relative `../../..` climbing across a module
boundary. **Adding a layer means adding its alias in all three files**;
miss one and it compiles but the Jest suites can't resolve it. There is no `src/common/` — it held
only `guards/` before this split and was removed once that moved out;
don't recreate it as a catch-all for whatever doesn't have an obvious
layer yet, add or ask for a properly named one instead.

## Tests

There is no test layer in this project: it is a reference implementation
meant to be read and run, and the checks are the reader's. Do not add a
test framework, a suite or a coverage tool unless the user asks for one.
