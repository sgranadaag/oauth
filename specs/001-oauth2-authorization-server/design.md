# Design: OAuth 2.0 Authorization Server (RFC 6749)

Status: draft

## Architecture note

**Revised twice during implementation.** The history, oldest to current,
is kept in full under Alternatives rather than deleted — that section
exists precisely so a later pass doesn't re-litigate a decision this
project already made and unmade once:

1. Originally built as a "brief" flat `ports`/`adapters` split (no
   separate domain layer, TypeORM entities doubling as the domain
   model).
2. Reversed to match `nest-hexagonal`'s full
   `domain/application/infrastructure` layering exactly — private-
   constructor entities with `create()`/`reconstitute()` factories,
   dedicated `ClientId`/`UserId` value objects, inbound *and* outbound
   ports with `Symbol` tokens for both use cases and repositories.
3. **Current: flattened again, further than step 1 ever was**, per
   explicit direction once real code existed to judge the trade-off
   against. This is the structure the codebase now has.

The current structure, per module (`client`, `user`, `oidc`):

- **No `domain/application/infrastructure` subfolders at all.** Every
  file lives directly under `src/modules/<name>/`, flat.
- **One entity class, doubling as the TypeORM row shape.** No separate
  domain/Postgres entity pair, no mapper. `id` is a plain `string`
  field — no `ClientId`/`UserId` value object, and (a corollary
  discovered while fixing the resulting test failures, see
  Alternatives) the Postgres column itself is a plain `varchar`, not
  `uuid` — nothing about "plain string id" was true only at the
  TypeScript layer.
- **One `<Name>Service` class per module, not one class per use case.**
  `ClientService`, `UserService` each hold every action for their
  module as a method (`create(...)`, and any future ones) — no
  `execute()`-only single-action classes, no inbound port/interface
  for them. Controllers inject the concrete service class directly.
- **One `<Name>Repository` class per module, injected directly by
  class — no port/interface, no `Symbol` token, no "Postgres" prefix.**
  `ClientRepository`, `UserRepository` wrap a TypeORM
  `Repository<Entity>` and expose the handful of methods the module
  actually needs. A module that needs another module's repository
  (`UserService` needs `ClientRepository`; `OidcModule`'s wiring needs
  it too) gets it because the owning module exports the repository
  class itself from its `@Module()` — Nest resolves a class as its own
  DI token, so this needs no token of any kind.
- **DTOs are the one thing still separated out**, into a `dto/`
  subfolder per module (`client/dto/`, `user/dto/`) — kept apart from
  the entity/repository/service/controller files sitting next to them,
  per explicit direction, even though everything else collapsed flat.
- File naming is `camelCase.role.ts` (`client.entity.ts`,
  `client.repository.ts`, `client.service.ts`, `client.controller.ts`,
  `client.module.ts`), module folders singular
  (`src/modules/client/`).
- Tests live under `src/tests/<module>/<name>.<role>.test.ts`; the unit
  layer covers **services, utils, and controllers** — see Alternatives
  ("Unit-testing entities, repositories, and adapters"). Services mock
  their repositories and controllers mock their services, so no unit
  test touches Postgres. Everything else (entities, repositories,
  adapters, guards) is verified through the e2e layer
  (`test/**/*.e2e-spec.ts`) or not at all.

Applied to the `oidc` module too, with two exceptions that were never
candidates for this flattening because they aren't *our* ports to begin
with:

- `OidcAdapter` implements `oidc-provider`'s own `Adapter` interface —
  an external contract defined by the library, not redeclared by this
  codebase. It still lives flat in `src/modules/oidc/`, just renamed
  from `TypeOrmOidcAdapter` (dropping the "TypeOrm" prefix now that
  there's no port it's contrasted against) and taking `ClientRepository`
  directly instead of an `IClientRepository` interface.
- `OIDC_ERRORS`/`OIDC_PROVIDER` remain `Symbol` DI tokens — these exist
  to bridge a *value from an external library* (the `errors` namespace,
  the constructed `Provider` instance) into Nest's DI graph, which is a
  different problem than "our own repository/use-case abstraction," so
  the token-elimination direction doesn't apply to them.

The password-grant handler is `PasswordGrantService`
(`grantTypes/passwordGrant.service.ts`) — kept as its own file rather than folded
into some other service, since it is the module's one custom action and
naming it for what it does (not `OidcService.something`) stays clearer.

The JWT signing key pair is still deliberately *not* a module at all —
unchanged from every earlier version of this design; see Alternatives.

## Component breakdown

| Component | Repository | Added/Modified | Responsibility |
|---|---|---|---|
| `ClientEntity` (`client.entity.ts`) | oauth | Added | The entity *is* the TypeORM row shape — no separate domain class, no mapper. Plain `string id` (no VO): `Client`'s own id *is* the OAuth `client_id` — no separate business identifier field (collapsed after the two-identifier version produced a real FK bug in testing; see Alternatives). Secret is bcrypt-hashed (one-way), same as user passwords — see Alternatives/Risks. |
| `ClientRepository` (`client.repository.ts`) | oauth | Added | Concrete class wrapping `Repository<ClientEntity>` — no port/interface/token. Exported by `ClientModule` so `UserModule`/`OidcModule` can inject it directly (Nest resolves a class as its own DI token). |
| `ClientService` (`client.service.ts`) | oauth | Added | REQ-1.1/1.2: `create(name, allowedScopes)` generates credentials, encrypts the secret, persists via `ClientRepository`. |
| `ClientController` (`client.controller.ts`) + `dto/` | oauth | Added | REST adapter (`POST /clients`, gated by `AdminGuard`), injecting `ClientService` directly by class. |
| `AdminGuard` | oauth | Added | REQ-1.3: gates client creation behind a bootstrap admin credential. Cross-cutting, lives at `src/guards/` (its own top-level layer, alongside a currently-empty `src/middlewares/` — moved out of a since-removed `src/common/guards/` once guards and middleware were split into dedicated layers). Unaffected by any of the module-layering reversals — e2e-tested only. |
| `UserEntity` (`user.entity.ts`) | oauth | Added | Parented by exactly one client, declared two ways deliberately: `clientId: string` (the plain FK column, what most code reads/writes) *and* `client: ClientEntity` (`@ManyToOne` + `@JoinColumn({ name: 'clientId' })`, `nullable: false`) so the parenting is explicit to TypeORM and the parent is loadable via `relations: { client: true }`. No ID value object — a relation to another entity is a different thing from an ID wrapper. See Alternatives. |
| `UserRepository` (`user.repository.ts`) | oauth | Added | Concrete class wrapping `Repository<UserEntity>` — no port/interface/token. Exported by `UserModule`. |
| `UserService` (`user.service.ts`) | oauth | Added | REQ-2: injects `ClientRepository` directly (cross-module) to validate the client exists (`NotFoundException` if not) and to read its current `allowedScopes` for the response; injects `UserRepository` to pre-check-and-reject a duplicate `(clientId, username)` with `ConflictException` before insert. Scope is never assigned here — REQ-2.4 is resolved live from the client, not stored per user. |
| `UserController` (`user.controller.ts`) + `dto/` | oauth | Added | REST adapter (`POST /users`), injecting `UserService` directly by class. Gated by `BasicTokenGuard` — the caller authenticates as the owning client via HTTP Basic auth, the same credential shape `POST /oauth/token` uses, rather than the client being an unauthenticated path/body parameter. See Alternatives. |
| `BasicTokenGuard` (`src/guards/basicToken.guard.ts`) | oauth | Added | REQ-2.1: authenticates a caller as a specific client via `Authorization: Basic base64(clientId:clientSecret)` — decodes the header, looks up the client via `ClientRepository`, `bcrypt.compare()`s the submitted secret against the stored hash, and attaches `clientId` to the request. Lives in the top-level `src/guards/` layer alongside `AdminGuard` — *every* guard does, including ones with a module dependency. `UserModule` (whose controller uses it, and which already imports `ClientModule` for `ClientRepository`) registers it as a provider: the layer owns the class, the consuming module owns the DI registration. |
| Signing key pair — `src/secrets/private.pem`, `src/secrets/public.pem` | oauth | Added | REQ-9.1: a static RS256 key pair, generated once by a setup script. `@utils/keys.util` reads the private file; `@config/oidc.config` derives the provider JWKS from it; the public file is what's handed to the frontend. No port/adapter/module — there's nothing here to swap. |
| `OidcModelEntity` (`oidcModel.entity.ts`) | oauth | Added | Generic TypeORM table (`modelName` + `id` + `payload` jsonb, plus `grantId`/`uid`/`userCode`/`expiresAt`/`consumedAt`) backing token/grant persistence. |
| `OidcAdapter` (`oidc.adapter.ts`) | oauth | Added | Implements `oidc-provider`'s own `Adapter` interface (the real "port" here, defined by the library) against Postgres; for `modelName === 'Client'` it delegates to `ClientRepository` (injected directly, concrete class) instead of `OidcModelEntity`. |
| `PasswordGrantService` (`grantTypes/passwordGrant.service.ts`) | oauth | Added | REQ-3 + the ROPC half of REQ-6. Injects `UserRepository` and `ClientRepository` directly (concrete classes, cross-module) and `OIDC_ERRORS`. Issues a genuine JWT access token (confirmed end-to-end, not hypothesized) via an explicit `new provider.ResourceServer(...)` passed to `AccessToken`'s `resourceServer` property. |
| `OidcErrors` token (`oidc.constants.ts` / `oidc.interfaces.ts`) | oauth | Added | `OIDC_ERRORS` DI token + type alias for `oidc-provider`'s `errors` namespace — resolved once via async factory in `OidcModule`, so nothing downstream needs its own dynamic `import()` of the ESM-only package. Not affected by the port-elimination direction — see Architecture note. |
| `DEFAULT_RESOURCE_INDICATOR`, `SUPPORTED_SCOPES` constants | oauth | Added | Shared between `PasswordGrantService` and the bootstrap. `SUPPORTED_SCOPES` is a placeholder static vocabulary — see Risks; `oidc-provider` requires one, it has no concept of "whatever scopes exist in the clients table." |
| `OidcModule` | oauth | Added | Registers `PasswordGrantService` (plain class provider), `OIDC_ERRORS`, and `OIDC_PROVIDER` as Nest providers (imports `ClientModule`/`UserModule` to inject their exported repository classes directly), and `OidcController`. Fully self-contained — `main.ts` no longer does anything Oidc-specific. |
| `OidcProvider` (`oidcProvider.ts`) | oauth | Added | A top-level `class OidcProvider extends Provider`, constructed with a named `OidcProviderDependencies` object. Its constructor passes `oidcIssuer(deps)`/`oidcConfig(deps)` to `super()`, then applies the two adjustments that only work on a live instance: `registerPasswordGrant()` and `useHashedClientSecrets()`. `OidcModule` news it up under the `OIDC_PROVIDER` token; mounting is `OidcController`'s job. Verified end-to-end (not just configured) to cover REQ-4, REQ-5, REQ-7, REQ-8, REQ-9. |
| `oidcConfig` / `oidcIssuer` (`src/config/oidc.config.ts`) | oauth | Added | Every configuration decision about the provider — adapter, `jwks` (from `@utils/keys.util`), `scopes`, `rotateRefreshToken`, `features.clientCredentials`/`resourceIndicators` — in the config layer, mirroring `postgresConfig`'s shape for TypeORM. |
| `OidcController` (`oidc.controller.ts`) | oauth | Added | Injects `OIDC_PROVIDER` and exposes **only the two endpoints this server uses**, each mapped explicitly: `@Post('token')` and `@Get('jwks')`, both delegating to `provider.callback()` via a shared private `forward()` that strips the `/oauth` prefix. Every other route the library implements (`/auth`, `/me`, `/session/end`, `/reg`, `/token/introspection`, `/token/revocation`, `/device`) is simply not mounted and 404s at the Nest layer. Replaced an earlier `@All('/*splat')` catch-all — see Alternatives. |

Single repo (`oauth`) — matches requirements.md; everything is "Added"
since the repo was empty at the start of this feature.

## Interfaces

```ts
// --- client module (src/modules/client/) ---
// client.entity.ts — Client's own id IS the OAuth client_id (see Component breakdown);
// plain string primary key, backed by a Postgres varchar column, not uuid (see Alternatives).
@Entity('clients')
class ClientEntity {
  @PrimaryColumn() id: string;
  @Column() clientSecretHash: string;        // bcrypt, one-way — see Alternatives
  @Column() name: string;
  @Column('text', { array: true }) allowedScopes: string[];
  @CreateDateColumn() createdAt: Date;
}

// client.repository.ts — concrete class, no port/interface/token
@Injectable()
class ClientRepository {
  constructor(@InjectRepository(ClientEntity) private readonly typeOrmRepository: Repository<ClientEntity>) {}
  save(client: ClientEntity): Promise<ClientEntity> { return this.typeOrmRepository.save(client); }
  findByClientId(clientId: string): Promise<ClientEntity | null> { return this.typeOrmRepository.findOneBy({ id: clientId }); }
}

// client.service.ts
interface CreateClientResult { client: ClientEntity; plainSecret: string }

@Injectable()
class ClientService {
  constructor(private readonly clientRepository: ClientRepository) {}
  async create(name: string, allowedScopes: string[]): Promise<CreateClientResult> {
    const plainSecret = randomUUID();                                  // REQ-1.2 — see Alternatives
    const clientSecretHash = await bcrypt.hash(plainSecret, 12);       // one-way — see Alternatives
    const client = new ClientEntity();
    client.id = randomUUID();                                          // IS the OAuth client_id
    client.clientSecretHash = clientSecretHash;
    client.name = name;
    client.allowedScopes = allowedScopes;
    const saved = await this.clientRepository.save(client);
    return { client: saved, plainSecret };                            // plaintext returned once, never persisted
  }
}

// client.controller.ts
@Controller('clients')
class ClientController {
  constructor(private readonly clientService: ClientService) {}       // direct class injection, no token
  @UseGuards(AdminGuard) @Post()
  async create(@Body() dto: CreateClientDto) {                         // REQ-1.3
    const { client, plainSecret } = await this.clientService.create(dto.name, dto.allowedScopes);
    return ClientResponseDto.fromEntity(client, plainSecret);          // JSON field is still named `clientId`
  }
}

// client.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([ClientEntity])],
  controllers: [ClientController],
  providers: [ClientRepository, ClientService],
  exports: [ClientRepository],   // exported by class — consumed directly by UserModule and OidcModule
})
class ClientModule {}
```

```ts
// --- user module (src/modules/user/) — every user is parented by exactly one client ---
@Entity('users')
@Unique(['clientId', 'username'])
class UserEntity {
  @PrimaryColumn() id: string;
  @Column() clientId: string;      // the plain FK column — what most code reads/writes
  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({ name: 'clientId' })
  client: ClientEntity;            // the declared relation, backed by the column above
                                   // (load with relations: { client: true } — TypeORM 1.x
                                   //  removed the relations: ['client'] string-array form)
  @Column() username: string;
  @Column() passwordHash: string;
  @CreateDateColumn() createdAt: Date;
}

@Injectable()
class UserRepository {
  constructor(@InjectRepository(UserEntity) private readonly typeOrmRepository: Repository<UserEntity>) {}
  save(user: UserEntity): Promise<UserEntity> { return this.typeOrmRepository.save(user); }
  findByClientAndUsername(clientId: string, username: string): Promise<UserEntity | null> {
    return this.typeOrmRepository.findOneBy({ clientId, username });
  }
}

interface CreateUserResult { user: UserEntity; allowedScopes: string[] }

@Injectable()
class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly clientRepository: ClientRepository,   // cross-module, injected directly by class
  ) {}
  async create(clientId: string, username: string, password: string): Promise<CreateUserResult> {
    const client = await this.clientRepository.findByClientId(clientId);
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);
    const existing = await this.userRepository.findByClientAndUsername(clientId, username);
    if (existing) throw new ConflictException(`Username ${username} is already registered under this client`); // REQ-2.2
    const passwordHash = await bcrypt.hash(password, 12);
    const user = new UserEntity();
    user.id = randomUUID();
    user.clientId = clientId;
    user.username = username;
    user.passwordHash = passwordHash;
    const saved = await this.userRepository.save(user);
    return { user: saved, allowedScopes: client.allowedScopes };  // REQ-2.4 — read live, not stored per user
  }
}

// basicToken.guard.ts (src/guards/) — same Basic-auth shape as POST /oauth/token
@Injectable()
class BasicTokenGuard implements CanActivate {
  constructor(private readonly clientRepository: ClientRepository) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { clientId: string }>();
    const header = request.header('authorization');
    if (!header?.startsWith('Basic ')) throw new UnauthorizedException('Missing client credentials');
    const [clientId, clientSecret] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(/:(.*)/);
    const client = await this.clientRepository.findByClientId(clientId);
    if (!client || !(await bcrypt.compare(clientSecret, client.clientSecretHash))) {
      throw new UnauthorizedException('Invalid client credentials');
    }
    request.clientId = clientId;    // route handler reads this instead of a :clientId param
    return true;
  }
}

// user.controller.ts — POST /users, gated by @UseGuards(BasicTokenGuard), injects UserService directly
@Controller('users')
class UserController {
  constructor(private readonly userService: UserService) {}
  @UseGuards(BasicTokenGuard) @Post()
  async create(@Req() request: Request & { clientId: string }, @Body() dto: CreateUserDto) {
    const { user, allowedScopes } = await this.userService.create(request.clientId, dto.username, dto.password);
    return UserResponseDto.fromEntity(user, allowedScopes);
  }
}

// user.module.ts imports ClientModule and exports UserRepository (by class) the same way
// ClientModule exports ClientRepository, so OidcModule can inject the repository for the
// password-grant lookup. UserModule also lists BasicTokenGuard in its own `providers` —
// the guards layer owns the class, the module whose controller uses it owns the DI
// registration, and ClientModule's export is what makes ClientRepository resolvable there.
// All plain Nest class-based DI, no token of any kind.
```

```ts
// --- Signing key pair (src/secrets/) — plain files, no module, no port/adapter ---
// src/secrets/private.pem  — PKCS#1 RSA private key; signs access tokens
// src/secrets/public.pem   — the matching public key; verifies them, safe to publish
//
// PEM is the only on-disk format. @utils/jwt.util reads these directly via
// jsonwebtoken. oidc-provider needs the key as a JWK Set instead, so
// @utils/keys.util derives one in memory at bootstrap:
const jwks = {
  keys: [{ ...createPrivateKey(readFileSync('src/secrets/private.pem', 'utf8')).export({ format: 'jwk' }),
           alg: 'RS256', use: 'sig' }],   // no `kid` — the library computes an RFC 7638 thumbprint
};
// oidc-provider derives and serves the public half itself at `/oauth/jwks` (REQ-9.2);
// public.pem is the same key material handed out directly, e.g. bundled into whatever the
// frontend build consumes, rather than fetched live — both are valid ways to satisfy REQ-9.2.
```

```ts
// --- oidc-provider's real Adapter contract (github.com/panva/node-oidc-provider, docs/README.md) ---
// This IS the "port" for the Oidc module — defined by the library, not redeclared by us, and
// therefore never a candidate for the port-elimination direction applied to Client/User.
interface Adapter {
  upsert(id: string, payload: Record<string, unknown>, expiresIn: number): Promise<void>;
  find(id: string): Promise<Record<string, unknown> | undefined>;
  findByUserCode(userCode: string): Promise<Record<string, unknown> | undefined>;
  findByUid(uid: string): Promise<Record<string, unknown> | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
}

// src/modules/oidc/oidc.adapter.ts
class OidcAdapter implements Adapter {
  constructor(
    private readonly modelName: string,
    private readonly oidcModelRepository: Repository<OidcModelEntity>,
    private readonly clientRepository: ClientRepository,   // concrete class, no interface
  ) {}
  // modelName === 'Client'  -> reads/writes via ClientRepository, mapped to
  //                            { client_id: client.id,
  //                              client_secret: client.clientSecretHash,  // the HASH, passed through
  //                                              // unchanged — the patched compareClientSecret
  //                                              // (below) bcrypt-compares against it
  //                              grant_types: ['client_credentials', 'password', 'refresh_token'],
  //                              redirect_uris: [], response_types: [],  // present-but-empty, or every
  //                                                                      // request 400s invalid_redirect_uri
  //                              scope, token_endpoint_auth_method: 'client_secret_basic' }
  // ('refresh_token' here needs the provider's own `scopes` config to include 'offline_access',
  //  or the provider itself never recognizes the grant — see Risks)
  // every other modelName   -> reads/writes OidcModelEntity rows keyed on (modelName, id)
}

// oidcErrors.token.ts — oidc-provider ships ESM-only; the one dynamic `import()` needed
// to reach its `errors` namespace happens once, in OidcModule's async factory (below), not
// per-call — Jest's default runtime can't do dynamic import() of real ESM without
// --experimental-vm-modules, so anything reached via constructor injection (this token)
// stays trivially unit-testable with a stub. Unaffected by the port-elimination direction.
const OIDC_ERRORS = Symbol('OidcErrors');
type OidcErrors = typeof import('oidc-provider').errors;

// src/modules/oidc/grantTypes/passwordGrant.service.ts (grounded against @types/oidc-provider's
// real declarations — Grant needs .addOIDCScope() explicitly, InvalidScope takes the offending
// scope as a 2nd arg, ResourceServerInstance is built via `new provider.ResourceServer(...)`)
@Injectable()
class PasswordGrantService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly clientRepository: ClientRepository,   // User only holds a plain clientId string, not a nested Client
    @Inject(OIDC_ERRORS) private readonly errors: OidcErrors,
  ) {}

  async handle(ctx: KoaContextWithOIDC): Promise<void> {
    const { errors } = this;
    const { username, password, scope } = ctx.oidc.params;
    const client = ctx.oidc.client;                       // already authenticated by the library
    const user = username ? await this.userRepository.findByClientAndUsername(client.clientId, username) : null;
    if (!user || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new errors.InvalidGrant('invalid credentials');           // -> RFC 6749 invalid_grant
    }
    const domainClient = await this.clientRepository.findByClientId(user.clientId);
    const allowedScopes = domainClient!.allowedScopes;   // REQ-2.4 — full inheritance, resolved live, no snapshot
    const requested = scope ? scope.split(' ').filter(Boolean) : allowedScopes;
    const disallowed = requested.filter((requestedScope) => !allowedScopes.includes(requestedScope));
    if (disallowed.length > 0) {
      throw new errors.InvalidScope('scope exceeds what is allowed for this client', disallowed.join(' ')); // REQ-6.3
    }
    const grantedScope = requested.join(' ');
    const provider = ctx.oidc.provider;                    // typed on Provider itself — AccessToken/RefreshToken/
                                                             // Grant/ResourceServer are real properties, just declared
                                                             // far down in @types/oidc-provider's Provider class
    const grant = new provider.Grant({ accountId: user.id, clientId: client.clientId });
    grant.addOIDCScope(requested);                          // scope is NOT a Grant constructor property
    // Required for JWT formatting to SURVIVE a later refresh (T18 finding) — without this,
    // the Grant has no recorded resource for a native refresh_token grant to re-resolve.
    grant.addResourceScope(DEFAULT_RESOURCE, requested);
    const grantId = await grant.save();
    ctx.oidc.entity('Grant', grant);

    // Explicit resourceServer — the documented, typed way a custom grant gets JWT-formatted
    // tokens (REQ-9.1) without going through the resourceIndicators pipeline native grants use.
    const resourceServer = new provider.ResourceServer(DEFAULT_RESOURCE, {
      scope: grantedScope, accessTokenFormat: 'jwt', jwt: { sign: { alg: 'RS256' } },
    });
    const accessToken = new provider.AccessToken({
      accountId: user.id, client, grantId, gty: 'password', scope: grantedScope, resourceServer,
    });
    ctx.oidc.entity('AccessToken', accessToken);
    const refreshToken = new provider.RefreshToken({
      accountId: user.id, client, grantId, gty: 'password', scope: grantedScope,
      resource: DEFAULT_RESOURCE,   // also required for T18's refresh-preserves-JWT-format finding
      // no resourceServer property exists on RefreshToken — refresh tokens are structurally
      // always opaque, confirming REQ-9.3 directly from the library's own types
    });
    ctx.oidc.entity('RefreshToken', refreshToken);
    ctx.body = {
      access_token: await accessToken.save(),
      refresh_token: await refreshToken.save(),
      expires_in: accessToken.expiration,
      token_type: 'Bearer',
      scope: grantedScope,
    };
  }
}

// --- src/config/oidc.config.ts: oidcConfig(deps) ---
// Verified end-to-end against the real library — this is what actually works, not a plan.
// The Configuration object lives in the config layer; the OidcProvider class below is
// constructed with it. `import { Provider } from 'oidc-provider'` is a plain static
// import — see Alternatives on why the earlier dynamic-import wrapper is gone.
function oidcConfig({ oidcModelRepository, clientRepository }): Configuration {
  return {
    adapter: (modelName: string) => new OidcAdapter(modelName, oidcModelRepository, clientRepository),
    clients: [],                       // intentionally empty — see "Alternatives" below
    // 'offline_access' isn't a business scope (SUPPORTED_SCOPES is) — its mere presence is what
    // makes oidc-provider enable the 'refresh_token' grant TYPE at all (lib/helpers/configuration.js
    // collectGrantTypes()); omit it and every client declaring 'refresh_token' gets
    // invalid_client_metadata, since the provider itself never recognizes the grant. Found by
    // reading the library's source directly, not docs — see Risks.
    scopes: [...SUPPORTED_SCOPES, 'offline_access'],
    jwks,                              // REQ-9.1 — derived from src/secrets/private.pem (above)
    rotateRefreshToken: true,          // REQ-5.4 — top-level Configuration property, NOT under features
    features: {
      clientCredentials: { enabled: true },
      resourceIndicators: {                             // REQ-9 — this is how oidc-provider issues JWT access tokens
        enabled: true,
        defaultResource: () => DEFAULT_RESOURCE,          // fixed, so no caller ever needs to pass `resource`
        getResourceServerInfo: (ctx, resourceIndicator, client) => ({
          scope: client.scope ?? '',                      // still capped by the client's allowedScopes (REQ-6)
          accessTokenFormat: 'jwt',                        // REQ-9.1
          jwt: { sign: { alg: 'RS256' } },
        }),
      },
    },
  };
}

// --- src/modules/oidc/oidcProvider.ts ---
// A top-level class: `Provider` is imported statically. OidcModule news this up under
// the OIDC_PROVIDER token; mounting is OidcController's job.
class OidcProvider extends Provider {
  constructor(private readonly dependencies: OidcProviderDependencies) {
    super(oidcIssuer(dependencies), oidcConfig(dependencies));
    this.registerPasswordGrant();
    this.useHashedClientSecrets();
  }

  // 'scope' MUST be listed here too — omitted, oidc-provider silently drops any caller-supplied
  // scope from ctx.oidc.params before the handler runs, so REQ-6.3 (invalid_scope) never fires
  // and the request quietly succeeds with the full allowed set instead. Found by a failing e2e
  // test (T17), not by reading docs — nothing flagged this as required.
  private registerPasswordGrant() {
    this.registerGrantType(
      'password',
      (ctx) => this.dependencies.passwordGrantService.handle(ctx),
      ['username', 'password', 'scope'],
    );
  }

  // Client secrets are bcrypt hashes, not plaintext — the library's default
  // compareClientSecret does a direct comparison, so it's overridden here. This is a real,
  // typed method on the library's own Client class (lib/models/client.js, declared in
  // @types/oidc-provider, called from lib/shared/client_auth.js), NOT a fork or a patch of
  // a private internal. See Alternatives for why the original "no such hook exists"
  // research was wrong.
  private useHashedClientSecrets() {
    this.Client.prototype.compareClientSecret = function (submitted: string) {
      return bcrypt.compare(submitted, this.clientSecret ?? '');   // this.clientSecret === the stored hash
    };
  }
}

// src/modules/oidc/oidc.controller.ts — a proper NestJS controller instead of raw app.use()
// middleware (an earlier approach, replaced — see Alternatives). Only the endpoints this
// server actually uses are mapped; everything else the library implements stays unmounted.
@Controller('oauth')
class OidcController {
  private readonly callback: (req: Request, res: Response) => Promise<void>;   // inherited from
                                                                                 // Koa — genuinely
                                                                                 // async, not void
  constructor(@Inject(OIDC_PROVIDER) provider: Provider) {
    this.callback = provider.callback();
  }

  @Post('token')                                     // REQ-3/4/5 — all three grants
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  @Get('jwks')                                       // REQ-9.2
  async jwks(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.forward(req, res);
  }

  // Rewritten from originalUrl, not a hardcoded path, so query strings survive.
  private async forward(req: Request, res: Response): Promise<void> {
    req.url = req.originalUrl.replace('/oauth', '');
    await this.callback(req, res);
  }
}

// OidcAdapter's Client mapping (find(), modelName === 'Client') must also include
// `redirect_uris: []` and `response_types: []` — present-but-empty, not simply absent — or
// oidc-provider's client metadata validation rejects every request with invalid_redirect_uri.
```

```ts
// --- OidcModelEntity (Client/User entities are shown in their own module blocks above) ---
@Entity('oidc_models')
class OidcModelEntity {
  @PrimaryColumn() id: string;
  @PrimaryColumn() modelName: string;
  @Column('jsonb') payload: Record<string, unknown>;
  @Column({ nullable: true }) grantId?: string;
  @Column({ nullable: true }) userCode?: string;
  @Column({ nullable: true }) uid?: string;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) consumedAt?: Date;
}
```

## Data flow

**Client creation (REQ-1)**
1. Admin calls `POST /clients` with a bootstrap admin credential and `{ name, allowedScopes }`.
2. `AdminGuard` validates the credential against `ADMIN_API_KEY` (env var) — rejects otherwise.
3. `ClientController` → `ClientService.create()`: generates a secret, encrypts it, constructs the `ClientEntity` directly (which gets its own `id` via `randomUUID()` — the OAuth `client_id`), saves via `ClientRepository`.
4. Response returns the plaintext secret once; only the bcrypt hash is ever stored — it cannot be recovered afterward.

**Signup (REQ-2)**
1. `POST /users` with `{ username, password }`, authenticated as the
   owning client via `Authorization: Basic base64(clientId:clientSecret)`
   — the same credential shape `POST /oauth/token` uses.
2. `BasicTokenGuard` decodes the header, looks up the client via
   `ClientRepository`, `bcrypt.compare()`s the submitted secret against
   the stored hash, and attaches `clientId` to the request (401 if the header is missing,
   malformed, or doesn't match a real client's credentials) — see
   Alternatives for why this replaced an unauthenticated `:clientId`
   path param.
3. `UserController` → `UserService.create(request.clientId, ...)`: loads
   the client via `ClientRepository` again (a defensive `NotFoundException`
   that's now effectively unreachable from this HTTP path, since the
   guard already proved the client exists — kept because `UserService`
   is still a general-purpose method with its own contract, not
   guaranteed to only ever be called from this one guarded route),
   pre-checks `(clientId, username)` uniqueness via `UserRepository`
   (409 if taken — REQ-2.2), hashes the password, constructs and saves
   the `UserEntity` holding the client's id as a plain string. No scope
   input to validate — the user inherits `client.allowedScopes` wholesale
   (REQ-2.4).
4. Response includes the client's current `allowedScopes` for information, but never the password.

**Token issuance — all three grants share one endpoint, `POST /oauth/token`, owned by `provider.callback()`:**
- *Client Credentials (REQ-4)*: handled natively once `features.clientCredentials.enabled = true`. `oidc-provider` authenticates the client via `OidcAdapter`'s `Client` lookup (which itself calls `ClientRepository`), checks `grant_types` includes `client_credentials`, restricts `scope` to the client's registered `scope` (mapped from `allowedScopes`), issues an access token with no refresh token — all native library behavior once the adapter/config are correct.
- *Resource Owner Password Credentials (REQ-3, REQ-6)*: `oidc-provider` parses the request, authenticates the client, confirms `password` is an allowed grant for it, then calls the bootstrap closure wrapping `PasswordGrantService.handle(ctx)` (above), which owns user lookup (via `UserRepository`) plus a follow-up `ClientRepository` lookup for scope resolution (since `User` only holds a plain `clientId`), credential check, and scope-ceiling enforcement by hand, since this grant has no built-in support.
- *Refresh Token (REQ-5)*: handled natively — `oidc-provider` looks up the refresh token via `OidcAdapter`, rejects if expired/revoked/consumed (`invalid_grant`, REQ-5.2), enforces requested scope ⊆ original grant (REQ-5.3), issues a new access token *and* a new refresh token while invalidating the one just used (REQ-5.4, `features.rotateRefreshToken`).
- Every path renders errors and success responses in `oidc-provider`'s own RFC 6749 §5.1/§5.2 shape (REQ-7, REQ-8) — no custom error mapping needed.
- Every access token, regardless of which grant issued it, is a JWT signed with the private key read from `src/secrets/private.pem` at bootstrap (REQ-9.1). `oidc-provider` also derives the public half itself and serves it at `/oauth/jwks`; `src/secrets/public.pem` is the same key handed directly to the frontend as a file rather than fetched live — either way satisfies REQ-9.2, a frontend (or any other party) verifies a token's origin independently, without ever calling back to this server. Refresh tokens are never JWTs (REQ-9.3) — rotation (REQ-5.4) and revocation still go through `OidcAdapter` as opaque references.

## Alternatives considered and rejected

### `nest-hexagonal`'s full `domain/application/infrastructure` layering, with dedicated ID value objects and inbound+outbound ports for both use cases and repositories

**Superseded.** This was step 2 of the architecture history above: private-
constructor entities with `create()`/`reconstitute()`, `ClientId`/`UserId`
value objects, `application/ports/{in,out}` with a `Symbol` token for every
use case *and* every repository, `infrastructure/adapters/{in,out}`. Built
in full, then explicitly reversed once real code existed to weigh
against — the directional clarity and framework independence it bought
wasn't worth the file count and indirection for a project this size, with
no anticipated second implementation of any repository or use case.
Recorded here, not deleted, precisely so this reversal isn't re-litigated
a third time. See the current Architecture note for what replaced it.

### A flat, in/out-less ports/adapters split, with TypeORM entities doubling as the domain model

**Superseded twice over** — this was step 1, the original decision (one
flat `ports/`/`adapters/` per module, no separate domain layer or
mapper). Reversed to the `nest-hexagonal` layering above, which was
itself later reversed to the current, even-flatter structure. The
current structure ends up close to this one in spirit (entity doubles
as the row shape again) but goes further: no ports/tokens survive for
use cases or repositories at all, where this original version still had
a flat port/adapter pair for each.

### Dedicated `ClientId`/`UserId` value objects

Dropped along with the `nest-hexagonal` layering reversal above. Their
only job was wrapping a `string` id with a `create()`/`from()`/`get()`
API; once entities went back to plain public fields, a VO wrapping a
single field added a layer with no behavior of its own to justify it.

### A bare `clientId: string` on `UserEntity`, with no declared relation

**Superseded.** When the VOs were dropped, `User`'s reference to its
owning client collapsed to a single plain column with an explicit "no
`@ManyToOne` relation object, nothing here ever reads it as a relation"
note. The FK constraint existed in Postgres the whole time, but nothing
in the entity layer said so.

Reversed per explicit direction — every user must be *parented* by a
client, and that parenting should be visible in the model, not only in
the schema. `UserEntity` now declares both `clientId: string` and
`client: ClientEntity` (`@ManyToOne` + `@JoinColumn({ name: 'clientId' })`,
`nullable: false`). Keeping both is the point: the column stays the
cheap path most code uses, while the relation makes the constraint
explicit to TypeORM and lets a caller load the parent on demand.

Notably this needed **no migration** — the FK (`users_clientId_fkey`)
and the `NOT NULL` on `clientId` were already there from `CreateUsers`
(re-added by `PlainStringIds`), so the declaration simply describes
schema that already existed. Verified directly against Postgres:
constraint present, column non-nullable, and an orphan insert rejected.

This does not reopen the VO decision above — a relation to another
entity is a different thing from a wrapper around an id.

### `uuid` as the Postgres column type for `id`/`clientId`

Dropped as a direct consequence of dropping the VOs — "just a plain id
(string)" turned out to mean the database shouldn't constrain the
format either, not only that the TypeScript type is `string`. Discovered
concretely, not just inferred: existing tests constructed entities with
human-readable string ids (`'client-entity-test-1'`, `'adapter-test-client'`),
which fail a real Postgres `uuid`-typed column with `invalid input syntax
for type uuid`. Fixed with a follow-on migration (`PlainStringIds`)
changing `clients.id`, `users.id`, and `users.clientId` to `varchar` —
had to drop and re-add the `users_clientId_fkey` constraint around the
type change, since Postgres re-validates that both sides of a foreign
key share a type the moment either side's type changes. Production code
still populates `id` with `randomUUID()` at creation time (`ClientService`/
`UserService`) — only the *constraint* was removed, not the practice.

### Inbound ports/tokens for use cases (`ICreateClientUseCase` + `CREATE_CLIENT_USE_CASE`, etc.)

Dropped along with the `nest-hexagonal` layering reversal. Controllers
now inject the concrete `<Name>Service` class directly — Nest resolves
a class as its own DI token, so the interface + `Symbol` pair was
pure ceremony with no second implementation ever anticipated for a
single-service module.

### Outbound repository ports/tokens (`IClientRepository` + `CLIENT_REPOSITORY`, etc.)

Same reasoning, dropped in the same pass, one step further than the
use-case ports: repositories are now injected by concrete class
(`ClientRepository`, `UserRepository`) everywhere, including
cross-module (`UserService` injecting `ClientRepository`,
`OidcModule`'s async factory injecting it too) — the owning module
exports the class itself rather than a token standing in for an
interface. `oidc-provider`'s own `Adapter` interface is unaffected by
this direction, since it's an external contract this codebase doesn't
own or get to simplify away.

### One use-case class per action (`CreateClientUseCase`, `CreateUserUseCase`, ...)

Replaced by one `<Name>Service` class per module holding every action as
a named method (`ClientService.create(...)`, `UserService.create(...)`).
With exactly one action per module today the difference is mostly
naming, but the shape is meant to hold as more actions get added later
(e.g. a future `ClientService.revoke(...)`) without spawning a new
class-plus-port pair for each one.

### Separating domain entity from Postgres entity, with a Mapper between them

Dropped in the same pass as the value objects — collapsing the pair
into one class (`ClientEntity`, `UserEntity`, doubling as both the
framework-free-ish model and the TypeORM row shape) removed the need
for `toDomain()`/`toPersistence()` mapping code that was otherwise pure
1:1 field copying with no transformation logic in it.

### In-memory adapter alongside the Postgres one

Rejected per explicit direction ("Postgres entirely") — unlike
`nest-hexagonal`'s in-memory/Postgres pair kept for demonstrating
swappability, there's only ever one repository implementation behind
each entity here, at any point in this project's history.

### Fully headless `oidc-provider` (custom Nest controllers call model classes directly, bypassing `provider.callback()` entirely)

Rejected because: the library's Koa pipeline is what performs
RFC-mandated request parsing, client authentication, grant-type
authorization, and scope-syntax validation *before* any handler runs.
Reimplementing that in hand-written Nest controllers to get a different
route shape would duplicate the exact work depending on the library was
meant to avoid. Mounting `provider.callback()` and using
`registerGrantType` only for the one grant it doesn't support (ROPC)
keeps that validation intact while still giving full control over the
actual business logic (client/user lookup, scope enforcement) through
the adapter and grant handler.

### Static `clients` configuration array

Rejected because REQ-1 requires clients to be created through the
running app. A static array read once at boot can't reflect a client
created afterward without a restart. Routing `Client` lookups through
`OidcAdapter` → `ClientRepository` instead keeps client creation
(REQ-1) and client authentication (REQ-4) reading the same data.

### Reversible AES-256-GCM encryption for client secrets

**Superseded — and it was adopted on the strength of a factual error,
which is the more important thing recorded here.**

Originally (T14) client secrets were stored AES-256-GCM encrypted,
reversibly, keyed by a dedicated env var, and decrypted back to
plaintext inside `OidcAdapter`'s `Client` mapping.
The stated justification was that `oidc-provider`'s default
`client_secret_basic`/`client_secret_post` authentication compares
plaintext directly, with "no documented hook" for hash comparison —
supposedly leaving forking the library as the only alternative.

**That research was wrong.** `Client#compareClientSecret(actual)` is a
real method on the library's own `Client` class
(`lib/models/client.js`), declared in `@types/oidc-provider`, and
invoked by `lib/shared/client_auth.js` for exactly these two auth
methods. Overriding it is a supported extension point, not a fork and
not a monkey-patch of a private internal. The original conclusion was
reached by searching the prose docs rather than the library's actual
source and type declarations — the same "read the real thing, don't
infer from docs" lesson this design records repeatedly elsewhere,
applied too late in this one case.

**Current: bcrypt (cost 12), one-way, identical to user passwords.**
`ClientService.create()` hashes the generated secret;
`ClientEntity.clientSecretHash` stores it; `OidcAdapter` passes that
hash through *unchanged* as the client metadata's `client_secret`; and
the `OidcProvider` class overrides `compareClientSecret` to
`bcrypt.compare()` the submitted value against it. `BasicTokenGuard`
(`POST /users`) does its own `bcrypt.compare` against the same column.
`secretCipher.util.ts` and the encryption-key env var were deleted
outright — no reversible path remains anywhere in the codebase, and the
"compromised encryption key exposes every client secret" trade-off that
had to be accepted before is simply gone.

Two real costs of the change, both accepted: bcrypt at cost 12 is
~600ms per hash, so e2e fixtures needed `testTimeout: 30000`
(`test/jest-e2e.json`); and every previously-issued client secret
became unusable at the migration boundary (`HashClientSecret`, a plain
column rename — old ciphertext is meaningless when compared as a bcrypt
hash), so any client provisioned before it needs a newly-issued secret.

### Unit-testing entities, repositories, and adapters

Superseded per explicit direction: the unit layer covers **business
logic only — services and utils**. Everything else is either a thin
wrapper over TypeORM/Nest or already exercised end-to-end, so it gets no
unit test of its own.

Five suites were deleted outright when this landed:
`client.entity.test.ts`, `user.entity.test.ts`,
`oidcModel.entity.test.ts`, `oidc.adapter.test.ts`, and
`signingKeys.test.ts`. What survives is `client.service.test.ts`,
`user.service.test.ts`, and `passwordGrant.service.test.ts`.

A useful side effect: every deleted suite was one that hit real
Postgres, and every DB-related test problem this project ran into came
from exactly those — the `TRUNCATE`-across-a-live-FK failure, the
ACCESS EXCLUSIVE lock timeout, and the table-wide-cleanup collisions all
lived in entity suites (see Risks). The surviving service tests mock
their repositories, so the unit layer no longer needs a database at all.

The e2e layer was deliberately **kept**. It boots the real `AppModule`
and covers the OAuth grant flows plus the REST endpoints — that's the
business logic this project actually exists to implement, just exercised
through HTTP rather than in isolation, and it is now the only automated
coverage of the `oidc-provider` wiring.

**Amended:** controllers were later added back to the unit layer
(`client.controller.test.ts`, `user.controller.test.ts`,
`oidc.controller.test.ts`), per explicit direction. They're instantiated
directly with a mocked service, so these cover the handler body only —
what it forwards, and what shape it maps back. Guards, DI wiring,
validation pipes, and status codes are untouched by them and remain
e2e-only. The most valuable thing they pin down is `UserController`
reading `clientId` from the guard-populated request rather than the
request body, and `OidcController`'s `/oauth` prefix rewrite, which is
otherwise only observable through a live server.

### Storing the signing key as `.jwk.json` files alongside the PEM

**Superseded.** `src/secrets/` used to hold four files: a PEM pair *and*
a JWK pair, on the belief that `oidc-provider` could only be given a JWK.

Half of that is true — its `jwks` config genuinely rejects a PEM
(`lib/helpers/initialize_keystore.js` asserts the value is a JWK Set
object). But the *file* never had to be a JWK: node converts one from the
other in a line, `createPrivateKey(pem).export({ format: 'jwk' })`.
Keeping both formats on disk meant two artifacts that could drift, for no
benefit.

Now `src/secrets/` holds only `private.pem` / `public.pem`, and the
factory derives the JWK Set in memory at boot. The generator script emits
PEM only, which also removed the last dependency on `jose` (uninstalled).

Two consequences: the published `kid` is now an RFC 7638 thumbprint the
library computes (`key.kid ??= calculateKid(key)`) rather than a random
UUID we generated, so tokens issued before this change reference a `kid`
that `/oauth/jwks` no longer advertises — regenerate and reissue. And
`alg: 'RS256'` / `use: 'sig'` are set explicitly on the derived key;
both are optional for RSA in the library's validation, but stating them
keeps the key single-purpose.

### Building the provider with a plain factory function rather than a subclass

**Superseded, in two steps.** `createOidcProvider` originally constructed
`new Provider(...)` and then mutated it —
`provider.registerGrantType(...)`,
`provider.Client.prototype.compareClientSecret = ...` — as loose
statements after the fact.

The first attempt at a class had to declare it *inside* the async
factory, on the reasoning that `Provider` is ESM-only and a CJS module
cannot `extends` a class it can only reach through `await import()`.

**That reasoning was outdated.** Node 22.12+/24 support `require()` of
ESM modules that have no top-level await, and `oidc-provider` qualifies —
confirmed directly (`require('oidc-provider')` returns `Provider`), and a
static `import { Provider } from 'oidc-provider'` compiles cleanly under
this project's `nest build`. So the wrapper was never load-bearing on
this runtime.

Current shape: `src/modules/oidc/oidcProvider.ts` exports a top-level
`class OidcProvider extends Provider`, constructed with a named
`OidcProviderDependencies` object. Its constructor passes
`oidcIssuer(deps)` and `oidcConfig(deps)` to `super()`, then applies the
two adjustments that can only be made to a live instance —
`registerPasswordGrant()` and `useHashedClientSecrets()`. The factory
function is gone entirely, as is `oidcProvider.factory.ts`.

Knock-on effects: `OidcModule` now imports `errors` statically and
provides it with `useValue` instead of an async factory, and **no runtime
dynamic import remains anywhere in `src/`** — which very likely makes
`--experimental-vm-modules` on `test:e2e` unnecessary, though that has not
been re-tested. The constraint only returns if this ever targets
Node < 22.12.

### Configuring the provider inline in the factory

**Superseded.** The whole `Configuration` object used to be built inside
the same file that constructed the provider. It now lives in
`src/config/oidc.config.ts` as `oidcConfig(deps)` / `oidcIssuer(deps)`,
matching the shape `postgresConfig(configService)` already had for
TypeORM — configuration decisions belong in the config layer, not inside
the thing being configured. Only the two live-instance adjustments stayed
with the class.

### Key-file reading spread across the files that needed it

**Superseded.** The provider factory read `private.pem` to derive its
JWK Set while `jwt.util` separately read both PEMs for signing and
verification. That is now one owner: `src/utils/keys.util.ts` exposes
`getPrivateKeyPem()`, `getPublicKeyPem()` and `getSigningJwks()`, each
cached, and is the only module that touches `src/secrets/`. `jwt.util`
consumes it for token operations; `oidc.config` consumes it for the
provider's `jwks`.

### A 256-bit random hex string as the client secret

Superseded per explicit direction: every generated identifier and
credential in this system is now a UUIDv4 — `ClientEntity.id` (the OAuth
`client_id`), `UserEntity.id`, and the client secret — produced by
`crypto.randomUUID()`, which is CSPRNG-backed. The first two were
already UUIDs; the secret was previously `randomBytes(32).toString('hex')`.

The trade-off, noted rather than hidden: a UUIDv4 carries 122 bits of
entropy versus 256 for the old value. That is still far outside
brute-force reach (comparable to a 128-bit key), and the secret is
bcrypt-hashed at rest regardless, so the practical security margin is
unchanged — but it *is* a reduction, and anyone raising the bar later
should reach for `randomBytes` rather than assume the UUID was chosen
for strength. It was chosen for format consistency across every
identifier the API hands out.

### A separate internal `id` distinct from the public OAuth `client_id`

Tried first (an internal PK plus a separately-generated public
`clientId` business field), then collapsed into one identifier after
implementation surfaced a real bug: `User` stores its owning client's
id, but that id was being generated independently from — and so never
equal to — the internal PK the `users` table's foreign key actually
pointed at, breaking every signup with a foreign-key violation. There
was never a real reason for the two to differ (both were just
generated UUIDs), so `Client`'s own identity now *is* the OAuth
`client_id` directly, matching how every other aggregate here has
exactly one identity.

### True per-resource RFC 8707 audience scoping

`oidc-provider` only issues JWT-formatted access tokens through its
`resourceIndicators` feature, which is designed around callers naming a
`resource` and different resource servers getting differently-scoped,
audience-restricted tokens. Full use of that (registering multiple
resource servers, letting clients request specific audiences) is
rejected *for now* — it's real functionality this repo doesn't need
yet, since there's exactly one implicit audience. `defaultResource`
supplies a single fixed resource identifier so no caller has to know
this machinery exists; `getResourceServerInfo` always returns the same
shape. Revisit if a real second resource server ever shows up.

### Mounting `provider.callback()` via raw `app.use()` middleware

Tried first (T16), then replaced — not because it didn't work (it did,
verified through all of T16–T18's e2e tests), but because it meant the
one HTTP-facing piece of this app that wasn't a proper Nest controller.
`OidcController` (`@Controller('oauth')`) now owns mounting instead,
injecting `OIDC_PROVIDER` (moved into `OidcModule`'s DI graph as an
async factory) rather than `main.ts` calling `app.get(...)` manually
after the fact. Functionally identical; consistent with every other
REST-facing piece staying inside Nest's controller system was the
actual reason to change it.

### Forwarding every `oidc-provider` route through one `@All('/*splat')` wildcard

**Superseded.** The first controller version was a single catch-all
handler that rewrote `req.url` and passed *anything* under `/oauth` to
`provider.callback()`. That worked, but it meant the app's public
surface was "whatever the library implements" rather than a decision —
`/auth`, `/me`, `/session/end`, `/reg`, `/token/introspection`,
`/token/revocation`, and the device-flow endpoints were all reachable
despite being Non-goals with no consent UI behind them. This was
already logged as an open Risk ("Unused routes still mounted").

Replaced per explicit direction with one explicit mapping per endpoint
actually used — `@Post('token')` and `@Get('jwks')`, the only two
referenced anywhere in the e2e suite, the Postman collection, or the
README. Both delegate to a shared private `forward()` that does the same
`/oauth`-prefix strip as before, so `provider.callback()` still performs
all RFC-mandated parsing, client authentication, and validation; only
the set of paths that reach it changed. Everything else 404s at the Nest
layer, which closes that Risk.

Two consequences worth noting: the catch-all also handled non-GET/POST
verbs (e.g. `OPTIONS` preflight) for those paths and no longer does, and
adding any further `oidc-provider` endpoint later (discovery at
`/.well-known/openid-configuration`, introspection, revocation) is now a
deliberate one-line addition rather than something already live. That
trade — explicit surface over automatic coverage — is the point.

Incidentally this retires a piece of Express-5 trivia the wildcard
needed: path-to-regexp v8 rejects a bare `'/*'`, which is why the
catch-all had to be the named `'/*splat'`. Named routes sidestep it.

### A dedicated Secrets module (port + adapter) for the signing key pair

Tried first, then rejected per explicit direction: a full
`ISecretsProvider` port/adapter/module was overkill for something that's
just two static files with nothing to swap. Unlike every repository in
this design (even before the port-elimination direction), there's no
anticipated second implementation of "read the signing key" — so it
never got the port/adapter treatment even in the `nest-hexagonal`-layered
version. Two plain files in `src/secrets/`, read directly, is the whole
mechanism, unchanged across every revision of this design.

### An unauthenticated `:clientId` path param on `POST /clients/:clientId/users`

Tried first (matches REQ-2.1's literal wording — "providing that
client's identifier" — read as a bare parameter), then replaced with
`POST /users` gated by `BasicTokenGuard` and its own Basic-auth check.
Rejected on reflection because it let anyone who merely *knew* (or
guessed/enumerated) a valid `client_id` create users under a client they
had no other relationship to — the client's identifier alone was never
meant to be a secret, so anything gated only by it isn't gated at all.
`BasicTokenGuard` requires the *secret* too, the same credential pair
`POST /oauth/token` already requires, so a caller can only create users
under a client it can actually authenticate as. Still satisfies REQ-2.1
("providing that client's identifier") — the identifier is still
provided, as the Basic-auth username half, just no longer trusted
unauthenticated. `UserService.create()`'s own `NotFoundException` for an
unknown client is effectively dead code from this one HTTP path now
(the guard already guarantees the client exists by the time the service
runs) but is left in place, since the service method has its own
contract independent of which controller happens to call it today.

### A single catch-all `src/common/` folder for cross-cutting code

`src/common/guards/admin.guard.ts` was the only thing `common/` ever
held. Rejected as a long-term home per explicit direction: a
general-purpose "put unclassified things here" folder tends to
accumulate unrelated code with nothing but "doesn't fit elsewhere" in
common. Replaced with dedicated top-level layers named for what they
actually are — `src/guards/` (route-level allow/deny guards) and
`src/middlewares/` (request-level Express/Nest middleware, currently
empty — nothing has needed one yet, but the layer exists so the first
one has an obvious home instead of prompting another `common/`-style
folder). `src/common/` itself was deleted once empty, not kept around
as a placeholder.

### Keeping a repository-dependent guard inside its module

**Superseded.** `BasicTokenGuard` (then `ClientAuthGuard`) originally
lived in `src/modules/client/` on the reasoning that a guard needing
`ClientRepository` belonged with the module that owns that repository,
leaving `src/guards/` for dependency-free guards like `AdminGuard`.
Reversed per explicit direction: **every** guard lives in
`src/guards/`, no exceptions. The module dependency turned out not to
need a location rule at all — the layer holds the class, and the module
whose controller applies it registers it as a provider (`UserModule`
lists `BasicTokenGuard`, and already imports `ClientModule` for
`ClientRepository`). Splitting guards across two homes by dependency
shape made "where does this guard live?" a judgment call on every new
guard; one layer makes it not a question. Renamed in the same pass —
`ClientAuthGuard` → `BasicTokenGuard`, naming it for the credential
mechanism it checks rather than the entity it happens to look up.

## Requirement coverage

"OidcProviderModule" below refers collectively to `OidcModule` (the Nest
provider registrations, including the `OIDC_PROVIDER` async factory),
`oidcProvider.ts` (the `OidcProvider` class, the actual
`Provider` construction), and `OidcController` (mounts it) — three
files, not one literal `OidcProviderModule.ts`.

| REQ ID | Covered by |
|---|---|
| REQ-1.1 | `Client` module (`ClientService`, `ClientRepository`) |
| REQ-1.2 | `Client` module |
| REQ-1.3 | AdminGuard |
| REQ-2.1 | `User` module (`UserService`, `UserRepository`) + `BasicTokenGuard` (client identity via Basic auth, not an unauthenticated path param) |
| REQ-2.2 | `UserService` (pre-check → `ConflictException`) + DB unique constraint on `(clientId, username)` as a backstop |
| REQ-2.3 | `User` module (response DTO omits password) |
| REQ-2.4 | `UserService` (reads `client.allowedScopes` live) |
| REQ-3.1 | PasswordGrantService, OidcProviderModule |
| REQ-3.2 | PasswordGrantService (lookup scoped by `ctx.oidc.client`) |
| REQ-3.3 | PasswordGrantService (`InvalidGrant`) |
| REQ-3.4 | PasswordGrantService |
| REQ-4.1 | OidcProviderModule (native `client_credentials`) |
| REQ-4.2 | OidcProviderModule + OidcAdapter (Client lookup/auth) |
| REQ-4.3 | OidcProviderModule (native library behavior) |
| REQ-4.4 | OidcAdapter (`Client.scope` from `allowedScopes`) + OidcProviderModule |
| REQ-5.1 | OidcProviderModule (native `refresh_token` grant) |
| REQ-5.2 | OidcAdapter + OidcProviderModule |
| REQ-5.3 | OidcProviderModule (native library behavior) |
| REQ-5.4 | OidcProviderModule (`features.rotateRefreshToken`) + OidcAdapter |
| REQ-6.1 | PasswordGrantService (REQ-3 path) / OidcProviderModule (REQ-4 path) |
| REQ-6.2 | PasswordGrantService / OidcProviderModule |
| REQ-6.3 | PasswordGrantService / OidcProviderModule |
| REQ-6.4 | OidcAdapter + OidcProviderModule |
| REQ-7.1 | OidcProviderModule (library's standard token response) |
| REQ-7.2 | OidcAdapter (`expiresAt`) + OidcProviderModule (expiry config) |
| REQ-7.3 | OidcProviderModule (native) |
| REQ-8.1 | OidcProviderModule (native error rendering) |
| REQ-8.2 | OidcProviderModule (native) |
| REQ-8.3 | OidcProviderModule (native RFC 6749 error shape) |
| REQ-9.1 | Signing key pair (`src/secrets/private.pem`) + OidcProviderModule (`jwks` + `features.resourceIndicators`) |
| REQ-9.2 | OidcProviderModule (native `/jwks` route) + `src/secrets/public.pem` (handed directly to the frontend) |
| REQ-9.3 | OidcProviderModule (native library behavior — refresh tokens never go through `resourceIndicators`) |

Uncovered requirements: none.

## Risks

- **Resolved: client secret storage vs. `oidc-provider`'s built-in
  auth.** See the "Reversible AES-256-GCM encryption for client secrets"
  alternative above. Resolved *twice*: first (T14, wrongly) as reversible
  encryption, on the false premise that no hash-comparison hook existed;
  then correctly as bcrypt + a `Client#compareClientSecret` override.
  No residual key-management risk remains — there is no encryption key
  to rotate or leak, and no reversible path to any stored secret. The
  lesson worth carrying forward is procedural, not cryptographic: the
  original conclusion came from searching prose docs instead of the
  library's source and `.d.ts`, which is exactly the failure mode the
  rest of this document repeatedly warns about.
- **New, unaddressed: `compareClientSecret` is overridden on the
  prototype, process-wide.** The override in `OidcProvider`
  mutates `provider.Client.prototype`, so it applies to every `Client`
  instance that provider creates. That's correct here (every client in
  this system stores a bcrypt hash) but would silently break any future
  client whose secret is stored some other way — there's no per-client
  dispatch. Revisit if mixed secret formats ever become a requirement.
- **Dynamic `Client` lookup via the adapter.** This design assumes that
  passing `clients: []` (or omitting it) routes every client lookup
  through `OidcAdapter` → `ClientRepository`. Confirmed working against
  the installed `oidc-provider` version, verified end-to-end.
- **Resolved: ESM-only distribution.** Confirmed real (`oidc-provider@9.12.0`'s
  own `package.json` declares `"type": "module"`, no CJS fallback) — not
  a hypothetical. Dynamic `import('oidc-provider')` from CJS works fine
  at actual runtime (verified directly with `node -e`); the friction is
  narrower than "how does the bootstrap import it" — it's that **Jest's
  default runtime can't execute a dynamic `import()` of real ESM at all**
  without `--experimental-vm-modules` (confirmed by hitting it directly
  in T15's own test). Rather than turn that flag on globally, the fix
  was architectural: the one dynamic import happens once, in
  `OidcModule`'s async factory (T16) — genuine production code
  that never runs under Jest — and everything else (`PasswordGrantService`,
  `OidcAdapter`) receives already-resolved values (`Provider`,
  `errors`) via DI instead of importing the package themselves. Anything
  else built later that needs to touch `oidc-provider` directly should
  follow the same shape rather than rediscovering this.
- **DI bridge into `registerGrantType`.** The library calls grant
  handlers as plain functions, outside Nest's request-scoped DI. The
  bootstrap closure resolves `PasswordGrantService` once via
  `moduleRef.get(...)` at startup — fine for a stateless singleton
  handler, but worth confirming nothing about it needs to be
  request-scoped before relying on that shape.
- **Resolved: unused routes are no longer mounted.** `provider.callback()`
  still *implements* the library's full route set, but `OidcController`
  now exposes only `@Post('token')` and `@Get('jwks')` explicitly, so
  nothing else is reachable — the authorization endpoint, `/me`,
  `/session/end`, `/reg`, introspection, revocation, and the device-flow
  routes all 404 at the Nest layer rather than sitting there as
  unreviewed surface area. See the Alternatives entry on the
  `@All('/*splat')` wildcard this replaced.
- **Signing key rotation is still unaddressed.** Where the key pair
  lives is settled (two plain files in `src/secrets/`), but not whether
  it's ever rotated — a new key pair issued while tokens signed with the
  old one are still valid needs multiple keys active in the JWKS at once
  (`kid`-keyed), which a single `private.pem` doesn't accommodate.
  Carried from requirements.md's open questions.
- **Real private key material living in the repo tree.** Committing
  `src/secrets/private.pem` as a literal file is the simplest thing
  that works for a teaching reference implementation, but it means the
  private key either gets committed to git (bad habit to demonstrate,
  even for a demo key) or the path exists only locally/in deployment and
  the file itself is gitignored. Leaning toward gitignoring the
  generated files and keeping only the generation script tracked — flag
  if a committed demo key pair (so a stranger can `git clone` and run
  immediately) is actually preferred instead.
- **Key generation is out-of-band, not a runtime component.** The
  actual RS256 key pair has to be generated once, e.g. via the `jose`
  package's `generateKeyPair`/`exportJWK`, and the result written to
  `src/secrets/{private,public}.pem` — this is a setup script/ops
  task, not application code, and isn't in the component breakdown
  above for that reason.
- **Resolved (was the single biggest unknown): custom grant handler vs.
  JWT format.** `PasswordGrantService` (T15) builds a `ResourceServerInstance`
  directly via `new provider.ResourceServer(...)` and passes it as the
  `AccessToken` constructor's own `resourceServer` property, rather than
  replicating the library's internal (non-public) native-grant resolution
  pipeline. Confirmed working end-to-end at T16: a real password-grant
  request through the live mounted endpoint returns a 3-segment
  `access_token` with header `{"alg":"RS256","typ":"at+jwt"}` (RFC 9068),
  and a 1-segment (opaque) `refresh_token` — REQ-9.1 and REQ-9.3 both
  confirmed by direct observation, not just typed-API plausibility.
- **New: `scopes` is a required, static, pre-declared vocabulary.**
  Discovered at T16 — `oidc-provider` rejects any client whose `scope`
  contains a value outside its top-level `scopes` config
  (`invalid_client_metadata: "scope must only contain Authorization
  Server supported scope values"`). It has no way to validate against
  "whatever scopes happen to exist in the clients table." Worked around
  with a placeholder constant (`SUPPORTED_SCOPES = ['read', 'write']`,
  `oidc.constants.ts`) sufficient to unblock T16 — not a full
  fix. Two real gaps remain, deliberately not addressed to avoid scope
  creep beyond T16: (1) this list should probably be configurable rather
  than hardcoded; (2) REQ-1 (client creation) currently lets an admin set
  `allowedScopes` to anything, including values outside this vocabulary —
  the failure only surfaces later, at token-request time, for that
  client's users, not at client-creation time where it'd be far more
  useful. Worth a `ClientService` validation pass before this is
  considered done.
- **New: two more `oidc-provider` client-metadata requirements, discovered
  empirically.** (1) `redirect_uris` and `response_types` must be present
  as empty arrays on every client, or the token endpoint rejects every
  request with `invalid_redirect_uri` — despite Authorization Code/Implicit
  being explicitly out of scope (Non-goals). (2) `'refresh_token'` is
  **not** a valid standalone `grant_types` value — declaring it throws
  `invalid_client_metadata`; refresh-token eligibility is implicit once a
  declared grant (`'password'`) actually issues one. Neither was
  documented anywhere found during earlier research; both came from
  reading the library's own validation error messages directly.
- **New: `refresh_token` must stay in `grant_types`, gated by a *different*
  static list.** T16's first pass removed `'refresh_token'` from the
  client's declared `grant_types` after `invalid_client_metadata`
  rejected it — a correct observation, but the wrong fix. Reading
  `lib/helpers/configuration.js`'s `collectGrantTypes()` directly showed
  why: `'refresh_token'` is only added to the *provider's own*
  recognized grant-type set if its top-level `scopes` config contains
  `'offline_access'` (a standard OIDC scope, unrelated to our own
  business scopes) — a client can't declare a grant the provider itself
  never enabled. Fix: `scopes: [...SUPPORTED_SCOPES, 'offline_access']`,
  and `'refresh_token'` restored to `grant_types`.
- **New: JWT formatting doesn't survive a refresh unless the resource is
  recorded on both the `Grant` and the `RefreshToken`.** T18 first showed
  the *initial* password-grant access token as a correct JWT, but the
  token from a subsequent native `refresh_token` grant came back opaque.
  `PasswordGrantService`'s explicit `resourceServer` (passed only to
  `AccessToken`) has no bearing on a later refresh, because refreshing
  is entirely native/library-driven and has nothing of ours to consult —
  it needs the *Grant* to know it was scoped to a resource
  (`grant.addResourceScope(DEFAULT_RESOURCE, requested)`) and the
  *RefreshToken instance itself* to carry that resource forward
  (`resource: DEFAULT_RESOURCE_INDICATOR` in its constructor properties) so a
  later refresh can re-resolve `getResourceServerInfo` for it. Neither
  requirement is mentioned in anything fetched from the library's docs
  during design — both found by a failing e2e assertion, then confirmed
  by re-reading the relevant constructor property list.
- **New, unaddressed: `findAccount` uses the library's default.**
  Every refresh (and any native flow that revalidates the account)
  currently logs `"default findAccount function called, you MUST change
  it in order to use your own account model"`. It doesn't fail anything
  our REQs check — we never rely on ID-token claims or account profile
  data — but the default's actual behavior (does it validate the
  account still exists at all, or unconditionally trust any `accountId`
  it's handed?) was never inspected. Worth a deliberate look before
  calling this production-ready, even though it's out of scope for what
  T16–T18 needed to prove.
- **New: e2e tests require `--experimental-vm-modules`.** Booting the
  real `AppModule` under Jest (as every e2e test does) eagerly
  instantiates `OidcModule`'s `OIDC_ERRORS` async factory, which does the
  one dynamic `import('oidc-provider')` — Jest's default runtime can't
  execute that without the flag. Scoped to `npm run test:e2e` only
  (`test:e2e` invokes `node --experimental-vm-modules
  node_modules/jest/bin/jest.js`, not the `jest` CLI shim directly, which
  is a POSIX shell script and fails outright on Windows under `node`);
  plain unit tests (`npm test`) need no such flag, since nothing in that
  suite boots the real `AppModule`.
- **Resolved: both test suites needed `--runInBand`.** Discovered as a
  ~33% reproducible flake rate on plain `npm test` (confirmed by running
  it four times in a row), and a hook timeout on `npm run test:e2e` once
  a fifth e2e suite was added. Root cause: several integration-style
  tests (`oidcModel.entity.test.ts`, `oidc.adapter.test.ts`, and
  every `test/*.e2e-spec.ts`) hit the *same* real Postgres tables, and
  Jest runs test files in parallel workers by default — one suite's
  `afterAll` (`repository.clear()`, or just a heavier e2e app boot)
  could race another suite's still-in-progress assertions on the same
  table. Both `test` and `test:e2e` npm scripts now pass `--runInBand`;
  confirmed stable across multiple repeated runs after the change. Only
  `test:watch` was left parallel, since flaky feedback during active
  dev iteration is a smaller cost than a slower watch loop.
- **New: `.save()` on an entity with a client-assigned primary key
  upserts rather than rejects a duplicate.** Discovered writing a
  uniqueness test for the flattened `ClientEntity`: TypeORM's `.save()`,
  given an entity whose primary key is already set, does a
  SELECT-then-insert-or-update — a second `.save()` with the same `id`
  silently *updates* the existing row instead of failing. `.insert()`
  issues a real `INSERT` unconditionally, so it's the one that actually
  exercises the Postgres primary-key constraint; used in the relevant
  test, not in `ClientRepository.save()` itself (which legitimately
  wants upsert-or-create semantics for normal application code).
- **New: `TRUNCATE` fails across a live foreign key, even with no
  referencing rows present.** `client.entity.test.ts`'s `afterAll` used
  `repository.clear()` (`TRUNCATE`), which Postgres refuses whenever
  *any* table has a foreign key referencing the target table — structural,
  not row-count-based, so it failed even when the `users` table was
  empty. Fixed by switching that one cleanup to
  `repository.createQueryBuilder().delete().execute()` (a real `DELETE`,
  which only cares about actual referencing rows). Every other
  integration test's cleanup target (`oidc_models`, `users`) has nothing
  referencing it, so `.clear()` remains fine there.
