# Tasks: oauth

Single-repo feature — every component in design.md's breakdown lives in
`oauth`. 18 tasks, ordered by dependency; parallel-safe groups are called
out explicitly.

**Note:** the module structure was reversed twice after these tasks were
originally written and checked off — first from a "brief" flat
ports/adapters split to `nest-hexagonal`'s full
`domain/application/infrastructure` layering, then flattened again,
further than the original ever was: no domain/application/infrastructure
subfolders at all, entities carry a plain `string` id with no value
object, no port/token survives for either a use case or a repository,
and each module's several use cases collapsed into one `<Name>Service`
class per module (`ClientService`, `UserService`). See design.md's
Architecture note and Alternatives section for the full history and
reasoning. `Files:` lines below have been updated to match the current,
flat structure; Verify/Satisfies prose is otherwise left as originally
written (some sentences still describe now-superseded specifics like
`Client.create()`/`reconstitute()` factory methods or a `port`/`adapter`
pair — read those as historical record of what was checked at the time,
not as the current API. design.md is the authoritative source for the
current shape of the code.

**Note on `Verify:` lines and tests:** the unit layer was later narrowed
to services and utils — the entity, repository, adapter, and signing-key
suites were deleted — and then **controllers were added back**, so the
current scope is **services, utils, and controllers** (see design.md's
Alternatives, "Unit-testing entities, repositories, and adapters"). The
new controller suites (`client.controller.test.ts`,
`user.controller.test.ts`, `oidc.controller.test.ts`) instantiate the
controller directly with a mocked service, so they cover the handler
body only — guards do not run in them. Several `Verify:` lines below
still describe the now-deleted entity/adapter tests; they record what
was actually checked when the task was completed, not what exists today.
`Files:` lines have been updated. The e2e layer
(`test/**/*.e2e-spec.ts`) was kept throughout and is unaffected.

## Scaffolding

### [x] T1 — Scaffold the NestJS project skeleton
Satisfies: (none directly — prerequisite for everything below)
Verify: `npm run build` and `npm run start:dev` boot cleanly; `npm run lint` passes on the generated skeleton.
Files: package.json, tsconfig*.json, nest-cli.json, webpack.config.js, eslint.config.mjs, .prettierrc, .nvmrc, src/main.ts, src/app.module.ts

### [x] T2 — Wire Postgres + TypeORM
Depends on: T1
Satisfies: (none directly — prerequisite for all persistence-backed tasks)
Verify: `docker compose up -d` starts Postgres; the app boots and establishes a DB connection with no error; `npm run migration:run` executes cleanly against an empty database.
Files: docker-compose.yml, src/config/postgres.config.ts, src/constants/environment.constant.ts, src/config/typeorm.datasource.ts, .env.example

## Clients module

### [x] T3 — Add `Client` domain entity + Postgres entity + migration
Depends on: T2
Parallel with: T12, T13 (and their descendants) — T8 must wait for this one (FK)
Satisfies: REQ-1.1, REQ-1.2 (schema)
Verify: migration runs up/down cleanly; unit test round-trips `Client.create()`/`reconstitute()`; integration test (via `ClientRepository`, folded into T4) saves and re-reads a row.
**Post-completion revision (flattening pass):** `id` dropped from `uuid`
to a plain `varchar` column (`*-PlainStringIds.ts` migration) — see
design.md's Alternatives ("`uuid` as the Postgres column type"). The
uniqueness test uses `.insert()`, not `.save()`, since `.save()` on an
entity with a pre-assigned primary key upserts instead of rejecting a
duplicate; cleanup uses a real `DELETE` via query builder instead of
`.clear()` (`TRUNCATE`), which Postgres refuses across a live FK
regardless of row count. Both are new findings in design.md's Risks.
Files: src/modules/client/client.entity.ts, src/migrations/postgres/*-CreateClients.ts, src/migrations/postgres/*-PlainStringIds.ts

### [x] T4 — Implement `ClientRepository` (port + Postgres adapter)
Depends on: T3
Satisfies: REQ-1.2 (persistence)
Verify: integration test against real Postgres — `save()` then `findByClientId()` round-trips a client.
Files: src/modules/client/client.repository.ts

### [x] T5 — Implement `ClientService`: credential generation
Depends on: T4
Satisfies: REQ-1.1, REQ-1.2
Verify: unit test (mocked `ClientRepository`) — `execute()` generates a unique id/secret per call, returns the plaintext secret exactly once, and the object handed to the repository carries only the hash, never the plaintext.
Files: src/modules/client/client.service.ts, src/tests/client/client.service.test.ts

### [x] T6 — Implement `AdminGuard`
Depends on: T1
Parallel with: T3, T4, T5, T8–T15 (no shared files)
Satisfies: REQ-1.3
Verify: e2e only, per convention (infrastructure isn't unit tested) — folded into T7's e2e test: request without/with wrong/with correct `x-admin-key`.
**Post-completion revision (flattening pass):** `src/common/` (which
held only this one guard) was retired in favor of dedicated top-level
`src/guards/` and `src/middlewares/` layers, named for what they are
rather than a general "common" catch-all — see design.md's Alternatives
("A single catch-all `src/common/` folder..."). `AdminGuard` moved to
`src/guards/admin.guard.ts`; the `@common/*` path alias was replaced
with `@guards/*`/`@middlewares/*` in `tsconfig.json`, `package.json`'s
Jest config, and `test/jest-e2e.json`.
Files: src/guards/admin.guard.ts

### [x] T7 — Implement `ClientController`, wire `ClientModule`
Depends on: T5, T6
Satisfies: REQ-1.1, REQ-1.2, REQ-1.3 (end-to-end)
Verify: e2e test — `POST /clients` without the admin credential → 401, wrong credential → 401, no row written either way; with it → 201 and a body containing `clientId`/`clientSecret`/`name`/`allowedScopes`.
Files: src/modules/client/client.controller.ts, src/tests/client/client.controller.test.ts, src/modules/client/dto/createClient.dto.ts, src/modules/client/dto/clientResponse.dto.ts, src/modules/client/client.module.ts, test/rest/client.e2e-spec.ts

## Users module

### [x] T8 — Add `User` domain entity + Postgres entity + migration
Depends on: T3
Parallel with: T12, T13 (and their descendants)
Satisfies: REQ-2.1 (schema), REQ-2.2 (unique constraint)
Verify: migration runs cleanly; unit test round-trips `User.create()`/`reconstitute()`; integration test (via `UserRepository`, folded into T9) confirms the `(clientId, username)` unique constraint rejects a duplicate insert but allows the same username under a different client.
**Post-completion revision (relation pass):** `UserEntity` now declares
an explicit `@ManyToOne(() => ClientEntity, { nullable: false })` +
`@JoinColumn({ name: 'clientId' })` alongside the existing plain
`clientId` column, so every user is visibly parented by exactly one
client at the model level, not only via the DB constraint. **No
migration was needed** — the FK and `NOT NULL` already existed from
`CreateUsers`/`PlainStringIds`; verified directly against Postgres
(constraint present, column non-nullable, orphan insert rejected) and
that the relation loads (`relations: { client: true }` — TypeORM 1.x
removed the `relations: ['client']` string-array form). See design.md's
Alternatives ("A bare `clientId: string` on `UserEntity`..."). This
suite's `afterAll` also switched from `.clear()` (TRUNCATE) to a real
`DELETE`, since TRUNCATE's ACCESS EXCLUSIVE lock made the hook time out
behind other suites' open connections.
Files: src/modules/user/user.entity.ts, src/migrations/postgres/*-CreateUsers.ts, src/migrations/postgres/*-PlainStringIds.ts

### [x] T9 — Implement `UserRepository` (port + Postgres adapter)
Depends on: T8
Satisfies: REQ-2.2 (persistence)
Verify: integration test — `save()` + `findByClientAndUsername()` round-trips a user; a duplicate `(clientId, username)` is rejected at the DB level (backstop behind T10's application-level check).
Files: src/modules/user/user.repository.ts

### [x] T10 — Implement `UserService`
Depends on: T9, T4
Satisfies: REQ-2.1, REQ-2.3, REQ-2.4
Verify: unit test (mocked `ClientRepository`/`UserRepository`) — unknown `clientId` → `NotFoundException`; duplicate `(clientId, username)` → `ConflictException` (REQ-2.2), save never called; password is hashed before being handed to the repository (captured argument ≠ plaintext); result's `allowedScopes` equals the client's current `allowedScopes` (REQ-2.4).
Files: src/modules/user/user.service.ts, src/tests/user/user.service.test.ts

### [x] T11 — Implement `UserController`, wire `UserModule`
Depends on: T10
Satisfies: REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4 (end-to-end)
Verify: table-driven e2e test — (a) first signup under a client → 201, no password in body, `scopes` matches the client's `allowedScopes`; (b) same username, same client → 409 (REQ-2.2 rejection); (c) same username, *different* client → 201 (REQ-2.2's explicit "allowed" case); (d) unknown `clientId` → 404.
**Post-completion revision (flattening pass):** `POST /clients/:clientId/users`
replaced with `POST /users`, gated by a new guard (then
`ClientAuthGuard` in `src/modules/client/`, since moved and renamed —
see the next note) requiring
`Authorization: Basic base64(clientId:clientSecret)` — the same
credential shape `POST /oauth/token` already requires — instead of
trusting a bare, unauthenticated `:clientId` path param. See design.md's
Alternatives ("An unauthenticated `:clientId` path param..."). Verify
criterion (d) above is superseded: an unknown/wrong client credential
now fails at the guard with 401, before `UserService`'s own 404 path is
ever reached from this route; e2e coverage was updated accordingly
(missing header → 401, wrong secret → 401, correct credentials → 201).
**Later revision (guards layer):** that guard was moved out of the
client module to `src/guards/basicToken.guard.ts` and renamed
`ClientAuthGuard` → `BasicTokenGuard` (named for the credential
mechanism, not the entity it looks up). *Every* guard now lives in
`src/guards/`, including ones with a module dependency — `UserModule`
registers it as a provider while the layer owns the class. See
design.md's Alternatives ("Keeping a repository-dependent guard inside
its module").
Files: src/modules/user/user.controller.ts, src/tests/user/user.controller.test.ts, src/guards/basicToken.guard.ts, src/modules/client/client.module.ts, src/modules/user/dto/createUser.dto.ts, src/modules/user/dto/userResponse.dto.ts, src/modules/user/user.module.ts (exports `UserRepository`, provides `BasicTokenGuard`), test/rest/user.e2e-spec.ts

## Signing keys

No module here on purpose (see design.md) — just two static files and the
script that produces them.

### [x] T12 — Generate the RS256 signing key pair into `src/secrets/`
Depends on: T1
Parallel with: T3–T11, T13 (and their descendants)
Satisfies: REQ-9.1, REQ-9.2 (key material)
Verify: running the script produces `src/secrets/private.jwk.json` (one RS256 private JWK) and `src/secrets/public.jwk.json` (the matching public JWK, no private fields); a quick test loads `private.jwk.json` and confirms it parses as a valid RS256 private key.
**Post-completion revision (PEM-only pass):** the JWK files were dropped
entirely. The script now emits **only** `private.pem` / `public.pem`
(PKCS#1) using `node:crypto`'s `generateKeyPairSync`, which also removed
the last use of `jose` — that package is uninstalled. `oidc-provider`'s
`jwks` option still requires a JWK Set object (it asserts
`Array.isArray(jwks.keys)`), but `@utils/keys.util` now derives
one in memory from the PEM via
`createPrivateKey(pem).export({ format: 'jwk' })`, so PEM is the single
on-disk source of truth. `kid` is no longer generated by us — the library
fills in an RFC 7638 thumbprint (`key.kid ??= calculateKid(key)`), so the
`kid` published at `/oauth/jwks` changes from the old random UUID.
Verified against the library's validation rules: `alg`/`use` are optional
for RSA keys and the derived key satisfies every required field.
Files: scripts/generate-signing-keys.ts, src/secrets/private.pem, src/secrets/public.pem, src/utils/keys.util.ts, src/config/oidc.config.ts, .gitignore

## Oidc integration

### [x] T13 — Add `OidcModelEntity` + migration
Depends on: T2
Parallel with: T3, T8, T12 (and their descendants)
Satisfies: supports REQ-5.2, REQ-7.2 (token/grant persistence)
Verify: migration runs cleanly; integration test confirms the composite `(id, modelName)` key and that `grantId` is queryable.
Files: src/modules/oidc/oidcModel.entity.ts, src/migrations/postgres/*-CreateOidcModels.ts

### [x] T14 — Implement `OidcAdapter`
Depends on: T13, T4
Satisfies: REQ-4.2, REQ-4.4, REQ-5.2, REQ-6.4, REQ-7.2
Verify: integration test per `Adapter` method (`upsert`/`find`/`consume`/`destroy`/`revokeByGrantId`) round-tripping through `OidcModelEntity`; a separate case for `modelName === 'Client'` confirming it delegates to `ClientRepository` and maps `client_id`/`client_secret`/`grant_types`/`scope` correctly. **Client-secret-storage risk resolved**: researched oidc-provider's docs directly, confirmed no hashed-secret hook exists, adopted reversible AES-256-GCM encryption (`src/utils/secretCipher.util.ts`) decrypted here — see design.md's updated Alternatives/Risks. Also required renaming `Client.clientSecretHash` → `clientSecretEncrypted` back through T3/T5/T7 (already-checked-off tasks) to keep naming honest.
**Post-completion revision — the above is WRONG and has been reversed.**
The "no hashed-secret hook exists" finding came from searching prose
docs; `Client#compareClientSecret` is a real, typed method on the
library's own `Client` class (`lib/models/client.js`, declared in
`@types/oidc-provider`, called from `lib/shared/client_auth.js`).
Client secrets are now bcrypt-hashed (cost 12) exactly like user
passwords: `ClientEntity.clientSecretHash` stores the hash,
`OidcAdapter` passes it through unchanged as `client_secret`, and
the `OidcProvider` class overrides `compareClientSecret` to
`bcrypt.compare()`. `secretCipher.util.ts`, its test, and the
encryption-key env var were deleted. Column renamed back via
the `HashClientSecret` migration. e2e needed `testTimeout: 30000` since
bcrypt at cost 12 is ~600ms per hash. Full reasoning in design.md's
Alternatives ("Reversible AES-256-GCM encryption for client secrets").
Files: src/modules/oidc/oidc.adapter.ts, src/modules/client/client.service.ts, src/modules/client/client.entity.ts, src/guards/basicToken.guard.ts, src/modules/oidc/oidcProvider.factory.ts, src/migrations/postgres/*-HashClientSecret.ts, test/jest-e2e.json

### [x] T15 — Implement the password-grant port/handler
Depends on: T9
Satisfies: REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-6.1, REQ-6.2, REQ-6.3
Verify: unit test with a mocked `UserRepository`/`ClientRepository` and a stubbed `provider` — invalid credentials → `InvalidGrant`; a requested scope outside the client's `allowedScopes` → `InvalidScope`; valid path builds an access + refresh token with the correct joined `scope` and writes `ctx.body` in the RFC 6749 §5.1 shape. Grounded against `@types/oidc-provider`'s real declarations (installed alongside `oidc-provider` itself) rather than assumption: `Grant` needs `.addOIDCScope()` called explicitly (scope isn't a constructor property), `errors.InvalidScope` takes the offending scope as a second argument, and `provider.ResourceServer` — not a plain object literal — is how a custom grant builds a `ResourceServerInstance` to get JWT-formatted access tokens (REQ-9.1) without the automatic `resourceIndicators` pipeline. Also: `oidc-provider`'s ESM-only dynamic import can't happen inside a class method under Jest's default runtime (`--experimental-vm-modules` would be needed) — moved to a one-time async factory in `OidcProviderModule` (T16), injected into the handler via `OIDC_ERRORS` token instead.
Files: src/modules/oidc/grantTypes/passwordGrant.service.ts, src/modules/oidc/oidc.constants.ts, src/tests/oidc/grantTypes/passwordGrant.service.test.ts

### [x] T16 — Bootstrap `OidcProviderModule`
Depends on: T12, T14, T15
Satisfies: REQ-4.1, REQ-4.3, REQ-5.1, REQ-5.3, REQ-5.4, REQ-7.1, REQ-7.3, REQ-8.1, REQ-8.2, REQ-8.3, REQ-9.1, REQ-9.2, REQ-9.3
Verify: e2e — `POST /oauth/token` with `grant_type=client_credentials` returns a JWT access token (3 dot-separated segments, `alg: RS256` header) and no `refresh_token`; invalid client credentials → `invalid_client`; unsupported `grant_type` → `unsupported_grant_type`; `GET /oauth/jwks` returns only public key material (no `d`/`p`/`q`), matching `src/secrets/public.jwk.json`. **The design's flagged "biggest unknown" is resolved**: confirmed by direct observation — a real password-grant request returns a 3-segment `access_token` with header `{"alg":"RS256","typ":"at+jwt"}` and a 1-segment opaque `refresh_token`. Getting here required fixing three more things `oidc-provider` requires but weren't documented anywhere found: a static `scopes` vocabulary (`invalid_client_metadata` otherwise), `redirect_uris`/`response_types` present as empty arrays on every client (`invalid_redirect_uri` otherwise), and dropping `'refresh_token'` from `grant_types` (not a valid standalone value). Also required scoping `--experimental-vm-modules` to `npm run test:e2e` only, since booting the real `AppModule` under Jest eagerly triggers `OidcModule`'s one dynamic `import('oidc-provider')`. All details in design.md's Risks and Alternatives.
**Post-completion revision**: the initial `app.use('/oauth', provider.callback())` mounting (raw Express middleware in `main.ts`) was replaced with a proper `OidcController` (`@Controller('oauth')`, then `@All('/*splat')` — Express 5 needs a named wildcard, a bare `'/*'` throws; that wildcard was itself later replaced by explicit per-endpoint routes, see the next note), with `Provider` construction moved into `OidcModule`'s own DI graph (`OIDC_PROVIDER` async factory in `oidcProvider.factory.ts`, replacing `oidcProvider.bootstrap.ts`'s `mountOidcProvider(app)`). `main.ts` no longer references anything Oidc-specific. Functionally verified identical — all e2e tests re-passed unchanged. Separately, this pass also surfaced and fixed a real ~33% test flake rate (both `test` and `test:e2e` now run `--runInBand`, since several integration tests share real Postgres tables and Jest's default parallel workers raced each other's `afterAll` cleanup against still-running assertions) — see design.md's Risks.
**Later revision (explicit endpoints):** the `@All('/*splat')` catch-all
was replaced with one explicit route per endpoint this server actually
uses — `@Post('token')` and `@Get('jwks')`, the only two referenced in
the e2e suite, the Postman collection, or the README. Both delegate to a
shared private `forward()` doing the same `/oauth`-prefix strip, so
`provider.callback()` still handles all RFC-mandated validation; only
the set of reachable paths changed. Every other library route (`/auth`,
`/me`, `/session/end`, `/reg`, `/token/introspection`,
`/token/revocation`, device flow) now 404s at the Nest layer — this
closes design.md's "Unused routes still mounted" Risk. Note the
catch-all also served non-GET/POST verbs on those paths and no longer
does. See design.md's Alternatives ("Forwarding every `oidc-provider`
route through one `@All('/*splat')` wildcard").
Files: src/modules/oidc/oidc.module.ts, src/modules/oidc/oidcProvider.ts, src/modules/oidc/oidc.controller.ts, src/tests/oidc/oidc.controller.test.ts, src/modules/oidc/oidc.constants.ts, src/app.module.ts, src/main.ts, package.json (`--runInBand` on `test`/`test:e2e`), test/oidcToken.e2e-spec.ts, test/passwordGrant.e2e-spec.ts, test/refreshToken.e2e-spec.ts

## End-to-end verification

### [x] T17 — e2e: Resource Owner Password Credentials grant, full flow
Depends on: T16, T11
Satisfies: REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4
Verify: sign up a user (T11's endpoint) under client A, then `POST /oauth/token` with `grant_type=password` — correct credentials under client A → 200 with access + refresh token; wrong password → `invalid_grant`; the same user's credentials submitted against client B's `client_id` → `invalid_grant` (REQ-3.2, cross-client isolation); a requested `scope` outside client A's `allowedScopes` → `invalid_scope`. This last case caught a real bug: `registerGrantType`'s params array (T16) only listed `['username', 'password']`, so oidc-provider silently dropped any caller-supplied `scope` before the handler ever saw it — REQ-6.3 never fired, requests quietly succeeded with the full allowed set instead. Fixed by adding `'scope'` to that array; see design.md.
Files: test/passwordGrant.e2e-spec.ts

### [x] T18 — e2e: Refresh Token grant + rotation
Depends on: T17
Satisfies: REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4
Verify: obtain a refresh token via T17's flow, exchange it for a new access + refresh token; reusing the now-consumed original refresh token → `invalid_grant` (rotation, REQ-5.4); requesting a wider scope than the original grant on refresh → rejected (REQ-5.3). Two more real `oidc-provider` requirements surfaced here, neither documented anywhere found: (1) `'refresh_token'` in a client's `grant_types` only validates if the provider's own `scopes` config includes `'offline_access'` — T16's earlier fix (removing `'refresh_token'` entirely) was a correct observation of the symptom but the wrong cause; reverted and fixed at the actual source instead. (2) JWT formatting on the *initial* access token doesn't carry over to a token minted by a later native refresh — that needs `grant.addResourceScope(DEFAULT_RESOURCE, requested)` on the `Grant` and `resource: DEFAULT_RESOURCE_INDICATOR` on the `RefreshToken` itself, so the refresh flow has something to re-resolve. Both fixed in `passwordGrant.service.ts` (T15) and the `OidcProvider` class (T16); full detail in design.md's Risks.
Files: test/refreshToken.e2e-spec.ts, src/modules/oidc/grantTypes/passwordGrant.service.ts, src/modules/oidc/oidcProvider.factory.ts, src/modules/oidc/oidc.adapter.ts
