---
description: Module structure and layering conventions for this repository
---

# Architecture

This structure was arrived at after two explicit reversals during the
original build (a "brief" flat ports/adapters split, then a full
`nest-hexagonal`-style `domain/application/infrastructure` layering with
ID value objects and port/token pairs for every use case and
repository — both tried, both superseded; see `specs/*/design.md`'s
Alternatives sections for the full reasoning). **Treat what's below as a
settled decision, not a default to rediscover** — don't reintroduce
either of those patterns without the user explicitly asking for it.

## Module shape

Every feature module lives flat under `src/modules/<name>/` — singular
folder name, **no** `domain/`, `application/`, or `infrastructure/`
subfolders. `src/modules/` is for the domain only; a module that is
plumbing rather than a business concept goes in `src/sharedModules/`
instead (see Shared modules below), with the same internal shape:

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

**A module owns its own interfaces and constants.** Constants go in one
`<name>.constants.ts` at the module root; interfaces go in an
`interfaces/` folder, **never in a single collected
`<name>.interfaces.ts`** — that file shape is gone. Create either only
when there is something to put in it (`oidc.constants.ts` holds every
symbol, scope and default that module defines).

**Every interface and type a module needs lives in
`<module>/interfaces/`, split by responsibility** — one file per
subject, named `<subject>.interface.ts` (singular, matching
`src/interfaces/`), holding the types that belong to that subject. The
oidc module has four: `grant.interface.ts` (`OidcClient`,
`GrantHandler`, `GrantTypeRegistration`, `GrantHandlerResolver`),
`passwordGrant.interface.ts` (`PasswordGrantParams`, `TokenBuildInput`),
`provider.interface.ts` (`OidcProviderDependencies`) and
`errors.interface.ts` (`OidcErrors`).

This holds **even for a type used by exactly one file**: a grant's own
param and token-building shapes are declared in `interfaces/` and
imported, not left local to the service. The split is by subject, not by
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
  `OidcErrors` is `oidc-provider`'s own error classes, raised only by
  the oidc module's grant code, so it stays in that module's
  `interfaces/errors.interface.ts`. A third-party library's errors are
  that module's business; a shape this app defines for itself is
  everyone's.

Plus `accessToken.interface.ts` (`AccessTokenClaims` and its sign/verify
options), which is the same case as the guards: produced by
`@utils/jwt.util`, consumed by `BearerTokenGuard` — two layers, no
module.

**Everything a module owns goes in that module instead**: the result of
a service method (`SignupResult`, `CreateClientResult`), a grant's
params and token-building shapes, a provider's dependency bag. These
describe this server's behaviour, and each has exactly one owner.

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
rather than a file per value. `oidc.constants.ts` holds the
`OIDC_PROVIDER`/`OIDC_ERRORS` symbols, `SUPPORTED_SCOPES`,
`OFFLINE_ACCESS_SCOPE`, `DEFAULT_RESOURCE_INDICATOR`,
`DEFAULT_OIDC_ISSUER`, `OIDC_MOUNT_PATH`, and the password-grant
type/params — all of which were previously scattered across four files or
duplicated as literals in two.

Subfolders inside a module are for **open-ended sets of one
responsibility**, not for layering. Three exist today: `interfaces/`,
`dto/`, and `grantTypes/` in the oidc module. Don't add one to separate "the service
layer" from "the repository layer" — that's the split this architecture
deliberately removed.

- **One entity class per aggregate, and it *is* the TypeORM row.** No
  separate domain/Postgres entity pair, no mapper. `id` (and any
  foreign-key field, e.g. `User.clientId`) is a plain `string` — no
  dedicated ID value object, and the Postgres column itself is
  `varchar`, not `uuid` (constraining the DB column type would
  contradict "plain string id" just as much as a TypeScript wrapper
  class would). Production code still populates `id` with
  `randomUUID()` at creation time — only the *format constraint* was
  dropped, not the practice.
- **A parent/child link is declared as a real relation, alongside the
  plain FK column.** `UserEntity` carries both `clientId: string` (the
  column) and `client: ClientEntity` (`@ManyToOne` + `@JoinColumn({ name:
  'clientId' })`, `nullable: false`) — every user is parented by exactly
  one client. Keep both: the column is what most code reads and writes
  without loading anything, the relation makes the parenting explicit to
  TypeORM and lets a caller pull the parent when it actually wants it
  (`relations: { client: true }` — TypeORM 1.x removed the string-array
  `relations: ['client']` form). This does *not* reopen the entity/VO
  question above: a relation to another entity is not an ID wrapper.
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
- **Custom OAuth grants live in `src/modules/oidc/grantTypes/`**, one
  `<name>Grant.service.ts` per grant (`passwordGrant.service.ts` and
  `otpGrant.service.ts` today). Each is an `@Injectable()`
  implementing `GrantHandler` — a single `handle(context)` method — and
  its unit test mirrors the path in `src/tests/oidc/grantTypes/`. Grants
  `oidc-provider` implements natively (client_credentials,
  refresh_token) have no file here at all.

  **Registration is data, not code.** `grantTypes/grantTypes.registry.ts`
  exports `CUSTOM_GRANT_TYPES: GrantTypeRegistration[]` — `{ type,
  params, service }` per grant. `OidcModule` turns every `service` into a
  provider, and `OidcProvider.registerCustomGrantTypes()` loops the array
  calling `registerGrantType`. **Adding a grant means writing its service
  and appending one entry; nothing else changes.** Because the handler
  set is only known at runtime, the module resolves each one through
  `ModuleRef` (`resolveGrantHandler`) instead of a fixed `inject` list.

  The registry lives in its own file, *not* in `oidc.constants.ts`: the
  grant services import their constants from there, so holding the list
  beside them would make `oidc.constants` ⇄ `passwordGrant.service` a
  cycle — and both sides are read at class-decoration time, so it would
  resolve to `undefined` at boot rather than failing loudly.

- **A grant service owns only what makes its grant different: how the
  user proves who they are.** `handle()` reads the params, calls its own
  `authenticateUser(client, params)` — which throws `InvalidGrant` when
  the proof fails — and hands the user to `TokenService.issue(...)` for
  the response body. **Authentication stays in the grant**, with
  whatever it needs injected directly (`UserRepository` and
  `verifyPassword` for password, plus `OtpRepository` for otp); it is
  not delegated to `UserService`. A grant that grows a
  `buildAccessToken` of its own, on the other hand, is a grant
  reimplementing the token module.
- **Issuing tokens is `TokenModule`'s job, never a grant's**
  (`src/modules/token/`). `TokenService.issue({ context, client, user,
  grantType, requestedScope })` resolves the scopes against the client's
  `allowedScopes`, creates the `Grant`, the access token and the refresh
  token, and returns the RFC 6749 §5.1 body — every grant gets the same
  `gty`, resource-indicator and JWT wiring for free, which is what stops
  the quirks in coding-standards from drifting between grants. Native
  grants (client_credentials, refresh_token) never reach it: the library
  issues those itself.
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

## Shared modules

`src/sharedModules/<name>/` holds the Nest modules that are **not part
of the domain**: stateless infrastructure a feature module imports —
a connection, a transport, a client for something external. They own no
entity, no business rule, and no state of their own; whatever they hold
belongs to the caller.

The test: **would this module still make sense, unchanged, in a product
that has nothing to do with OAuth?** Yes → `src/sharedModules/`. It
names a concept this server owns (client, user, oidc) → `src/modules/`.

One exists today:

- `redis/` — `RedisModule`, which builds the single Redis connection and
  exports it under the `REDIS_CLIENT` symbol
  (`redis.constants.ts`), then closes it on shutdown. It decides
  nothing about what is stored: **the module that owns the data writes
  its own repository over that client**, in its own module, exactly as
  it would over a TypeORM repository.

Their construction config still lives in `src/config/` with everything
else's (`redisConfig` beside `postgresConfig` and `oidcConfig`) — a
shared module is where the wiring lives, not where the settings are
decided. Import them through the `@sharedModules/*` alias.

## What this does *not* apply to

- **An external library's own contract is not a "port" to eliminate.**
  `oidc-provider`'s `Adapter` interface (implemented by `OidcAdapter`)
  is defined by the library, not by this codebase — it stays as-is
  regardless of how far the internal port-elimination direction goes.
- **DI tokens for bridging a third-party value are not the same problem
  as an internal port/token.** `OIDC_ERRORS` and `OIDC_PROVIDER` are
  `Symbol` tokens carrying values that only exist because
  `oidc-provider` itself must be constructed/imported once (it's
  ESM-only — see the coding-standards rule) — they aren't standing in
  for an interface with a swappable implementation, so they're
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

    **It stays offline — no database read, no `oidc-provider` call.**
    A revoked token therefore still passes this guard until its `exp`;
    see the coding-standards rule for why that's the accepted trade-off
    and not a gap to close with a revocation-list lookup.

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
    `getSigningJwks()` (which derives the JWK Set `oidc-provider`
    requires from the PEM, in memory). All three cache after first read.
  - `jwt.util.ts` — the **only** place access tokens are signed and
    verified, via `jsonwebtoken` on the PEMs from `keys.util`. Do not
    verify a token anywhere else; guards call `verifyAccessToken()`.
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
  `oidcConfig`/`oidcIssuer` for oidc-provider. Config decisions live
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
`@config/*`, `@constants/*`, `@interfaces/*`, `@sharedModules/*` in `tsconfig.json`,
mirrored in `package.json`'s and `test/jest-e2e.json`'s Jest
`moduleNameMapper`) — use those aliases (and `@modules/*`, `@tests/*`)
for all imports, no relative `../../..` climbing across a module
boundary. **Adding a layer means adding its alias in all three files**;
miss one and it compiles but the Jest suites can't resolve it. There is no `src/common/` — it held
only `guards/` before this split and was removed once that moved out;
don't recreate it as a catch-all for whatever doesn't have an obvious
layer yet, add or ask for a properly named one instead.

## Tests

**Unit tests cover services, utils, and controllers.** Entities,
repositories, adapters, guards, DTOs, modules, and factories are
deliberately untested at this layer: they're either thin wrappers over
TypeORM/Nest or exercised end-to-end instead. Don't add a unit test for
them, and don't treat their absence as a coverage gap to fill.

- `src/tests/<module>/<name>.service.test.ts` — one per service, same
  base name as the source file. Services mock the repository classes
  they depend on (plain object cast to the repository type), so these
  need no database.
- `src/tests/<module>/<name>.controller.test.ts` — one per controller.
  Instantiate the controller directly (`new XController(serviceMock)`)
  with its service mocked; assert what it forwards to the service and
  what shape it maps back. **Guards do not run** under direct
  instantiation, so a controller unit test never covers `AdminGuard` or
  `BasicTokenGuard` — that stays e2e. Worth asserting here: that a
  handler reads request state the guard populated (e.g. `UserController`
  taking `clientId` from `request.clientId`, never the body) and that a
  response DTO omits secrets.
- `src/tests/<...>/<name>.util.test.ts` — same idea for anything under
  `src/utils/`. (That folder is currently empty; the rule is
  forward-looking.)
- `src/tests/setupEnv.ts` — Jest setup, not a test.

Use `beforeEach`/`afterEach` — not `beforeAll`/`afterAll` — wherever a
test needs per-test data set up or torn down. Build fixtures (entities,
mocks, stub providers) in `beforeEach` so each test starts from a fresh
copy and can mutate its own without leaking into the next; put teardown
(`jest.restoreAllMocks()`, and any cleanup a test's own side effects
require) in `afterEach`. `beforeAll` is only for genuinely
one-time-per-file setup that no test mutates. Where fixtures differ per
test, keep a parameterised `buildX(...)` helper and call it inside the
test, but still rebuild the shared baseline in `beforeEach`.

The e2e layer (`test/**/*.e2e-spec.ts`) is separate and stays: it boots
the real `AppModule` against a real Postgres and covers the OAuth grant
flows (client_credentials, password, refresh rotation, JWKS) plus the
REST endpoints. It remains the only place guards, DI wiring, validation
pipes, and HTTP status codes are actually exercised — a controller unit
test covers the handler body and nothing around it.

See the coding-standards rule for gotchas these suites have hit.
