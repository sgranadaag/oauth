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
- Tests live under `src/tests/<module>/<name>.<role>.test.ts` — same
  convention as before, entity/repository/service integration tests
  hit real Postgres, controllers/guards stay e2e-only
  (`test/rest/<name>.e2e-spec.ts`).

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
(`passwordGrant.service.ts`) — kept as its own file rather than folded
into some other service, since it is the module's one custom action and
naming it for what it does (not `OidcService.something`) stays clearer.

The JWT signing key pair is still deliberately *not* a module at all —
unchanged from every earlier version of this design; see Alternatives.

## Component breakdown

| Component | Repository | Added/Modified | Responsibility |
|---|---|---|---|
| `ClientEntity` (`client.entity.ts`) | oauth | Added | The entity *is* the TypeORM row shape — no separate domain class, no mapper. Plain `string id` (no VO): `Client`'s own id *is* the OAuth `client_id` — no separate business identifier field (collapsed after the two-identifier version produced a real FK bug in testing; see Alternatives). Secret is reversibly encrypted, not hashed — see Alternatives/Risks. |
| `ClientRepository` (`client.repository.ts`) | oauth | Added | Concrete class wrapping `Repository<ClientEntity>` — no port/interface/token. Exported by `ClientModule` so `UserModule`/`OidcModule` can inject it directly (Nest resolves a class as its own DI token). |
| `ClientService` (`client.service.ts`) | oauth | Added | REQ-1.1/1.2: `create(name, allowedScopes)` generates credentials, encrypts the secret, persists via `ClientRepository`. |
| `ClientController` (`client.controller.ts`) + `dto/` | oauth | Added | REST adapter (`POST /clients`, gated by `AdminGuard`), injecting `ClientService` directly by class. |
| `AdminGuard` | oauth | Added | REQ-1.3: gates client creation behind a bootstrap admin credential. Cross-cutting, lives at `src/common/guards/`, unaffected by either layering reversal — e2e-tested only. |
| `UserEntity` (`user.entity.ts`) | oauth | Added | Plain `clientId: string` field referencing the owning client — no VO, no `@ManyToOne` relation object, nothing here ever reads it as a relation. |
| `UserRepository` (`user.repository.ts`) | oauth | Added | Concrete class wrapping `Repository<UserEntity>` — no port/interface/token. Exported by `UserModule`. |
| `UserService` (`user.service.ts`) | oauth | Added | REQ-2: injects `ClientRepository` directly (cross-module) to validate the client exists (`NotFoundException` if not) and to read its current `allowedScopes` for the response; injects `UserRepository` to pre-check-and-reject a duplicate `(clientId, username)` with `ConflictException` before insert. Scope is never assigned here — REQ-2.4 is resolved live from the client, not stored per user. |
| `UserController` (`user.controller.ts`) + `dto/` | oauth | Added | REST adapter (`POST /users`), injecting `UserService` directly by class. Gated by `ClientAuthGuard` — the caller authenticates as the owning client via HTTP Basic auth, the same credential shape `POST /oauth/token` uses, rather than the client being an unauthenticated path/body parameter. See Alternatives. |
| `ClientAuthGuard` (`src/modules/client/clientAuth.guard.ts`) | oauth | Added | REQ-2.1: authenticates a caller as a specific client via `Authorization: Basic base64(clientId:clientSecret)` — decodes the header, looks up the client via `ClientRepository`, decrypts its stored secret for direct comparison (same mechanism `oidc-provider`'s own client auth uses), and attaches `clientId` to the request. Lives in the `client` module (not `common/guards/`, unlike `AdminGuard`) since it depends on `ClientRepository`; provided *and* exported by `ClientModule` so `UserModule` (which already imports `ClientModule`) can apply it to `UserController` via Nest's normal class-based DI. |
| Signing key pair — `src/secrets/private.jwk.json`, `src/secrets/public.jwk.json` | oauth | Added | REQ-9.1: a static RS256 key pair, generated once by a setup script. `oidcProvider.factory.ts` reads the private file directly; the public file is what's handed to the frontend. No port/adapter/module — there's nothing here to swap. |
| `OidcModelEntity` (`oidcModel.entity.ts`) | oauth | Added | Generic TypeORM table (`modelName` + `id` + `payload` jsonb, plus `grantId`/`uid`/`userCode`/`expiresAt`/`consumedAt`) backing token/grant persistence. |
| `OidcAdapter` (`oidc.adapter.ts`) | oauth | Added | Implements `oidc-provider`'s own `Adapter` interface (the real "port" here, defined by the library) against Postgres; for `modelName === 'Client'` it delegates to `ClientRepository` (injected directly, concrete class) instead of `OidcModelEntity`. |
| `PasswordGrantService` (`passwordGrant.service.ts`) | oauth | Added | REQ-3 + the ROPC half of REQ-6. Injects `UserRepository` and `ClientRepository` directly (concrete classes, cross-module) and `OIDC_ERRORS`. Issues a genuine JWT access token (confirmed end-to-end, not hypothesized) via an explicit `new provider.ResourceServer(...)` passed to `AccessToken`'s `resourceServer` property. |
| `OidcErrors` token (`oidcErrors.token.ts`) | oauth | Added | `OIDC_ERRORS` DI token + type alias for `oidc-provider`'s `errors` namespace — resolved once via async factory in `OidcModule`, so nothing downstream needs its own dynamic `import()` of the ESM-only package. Not affected by the port-elimination direction — see Architecture note. |
| `DEFAULT_RESOURCE`, `SUPPORTED_SCOPES` constants | oauth | Added | Shared between `PasswordGrantService` and the bootstrap. `SUPPORTED_SCOPES` is a placeholder static vocabulary — see Risks; `oidc-provider` requires one, it has no concept of "whatever scopes exist in the clients table." |
| `OidcModule` | oauth | Added | Registers `PasswordGrantService` (plain class provider), `OIDC_ERRORS`, and `OIDC_PROVIDER` as Nest providers (imports `ClientModule`/`UserModule` to inject their exported repository classes directly), and `OidcController`. Fully self-contained — `main.ts` no longer does anything Oidc-specific. |
| `oidcProvider.factory.ts` (`createOidcProvider(...)`, `OIDC_PROVIDER` async factory) | oauth | Added | Constructs the `Provider` instance (adapter, `jwks` read from `src/secrets/private.jwk.json`, `scopes`, `features.clientCredentials`/`resourceIndicators`, top-level `rotateRefreshToken`) and returns it — mounting is `OidcController`'s job now, not this file's. Deliberately *not* class-ified beyond a plain function — construction/wiring code with no anticipated second implementation. Verified end-to-end (not just configured) to cover REQ-4, REQ-5, REQ-7, REQ-8, REQ-9. |
| `OidcController` (`oidc.controller.ts`) | oauth | Added | Injects `OIDC_PROVIDER`, mounts it as a proper NestJS controller (`@Controller('oauth')`, `@All('/*splat')` forwarding to `provider.callback()`) instead of raw `app.use()` middleware — consistent with every other REST-facing piece staying inside Nest's controller system. |

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
  @Column() clientSecretEncrypted: string;   // reversible, not hashed — see Alternatives
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
// utils/secretCipher.util.ts — AES-256-GCM, keyed by CLIENT_SECRET_ENCRYPTION_KEY; encryptSecret/decryptSecret
interface CreateClientResult { client: ClientEntity; plainSecret: string }

@Injectable()
class ClientService {
  constructor(private readonly clientRepository: ClientRepository) {}
  async create(name: string, allowedScopes: string[]): Promise<CreateClientResult> {
    const plainSecret = randomBytes(32).toString('hex');               // REQ-1.2
    const clientSecretEncrypted = encryptSecret(plainSecret);          // reversible — see Alternatives
    const client = new ClientEntity();
    client.id = randomUUID();                                          // IS the OAuth client_id
    client.clientSecretEncrypted = clientSecretEncrypted;
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
// --- user module (src/modules/user/) — same shape; cross-aggregate reference is a plain clientId: string ---
@Entity('users')
@Unique(['clientId', 'username'])
class UserEntity {
  @PrimaryColumn() id: string;
  @Column() clientId: string;      // FK to clients.id — plain field, no relation object
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

// clientAuth.guard.ts (src/modules/client/) — same Basic-auth shape as POST /oauth/token
@Injectable()
class ClientAuthGuard implements CanActivate {
  constructor(private readonly clientRepository: ClientRepository) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { clientId: string }>();
    const header = request.header('authorization');
    if (!header?.startsWith('Basic ')) throw new UnauthorizedException('Missing client credentials');
    const [clientId, clientSecret] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(/:(.*)/);
    const client = await this.clientRepository.findByClientId(clientId);
    if (!client || decryptSecret(client.clientSecretEncrypted) !== clientSecret) {
      throw new UnauthorizedException('Invalid client credentials');
    }
    request.clientId = clientId;    // route handler reads this instead of a :clientId param
    return true;
  }
}

// user.controller.ts — POST /users, gated by @UseGuards(ClientAuthGuard), injects UserService directly
@Controller('users')
class UserController {
  constructor(private readonly userService: UserService) {}
  @UseGuards(ClientAuthGuard) @Post()
  async create(@Req() request: Request & { clientId: string }, @Body() dto: CreateUserDto) {
    const { user, allowedScopes } = await this.userService.create(request.clientId, dto.username, dto.password);
    return UserResponseDto.fromEntity(user, allowedScopes);
  }
}

// user.module.ts imports ClientModule and exports UserRepository (by class) the same way
// ClientModule exports ClientRepository (and now ClientAuthGuard too), so OidcModule can
// inject the repository for the password-grant lookup, and UserModule's own controller can
// apply the guard — both via plain Nest DI, no token of any kind.
```

```ts
// --- Signing key pair (src/secrets/) — plain files, no module, no port/adapter ---
// src/secrets/private.jwk.json  — one RS256 private JWK (RFC 7517 shape); fed into oidc-provider's `jwks`
// src/secrets/public.jwk.json   — the matching public JWK; handed directly to the frontend
//
// Read once, at bootstrap, wherever oidcProvider.factory.ts needs it:
const privateJwk = JSON.parse(readFileSync(join(process.cwd(), 'src', 'secrets', 'private.jwk.json'), 'utf8'));
// oidc-provider derives and serves the public half itself at `/oauth/jwks` (REQ-9.2) regardless;
// public.jwk.json is the same key material handed out directly, e.g. checked into whatever the
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
  //                              client_secret: decryptSecret(client.clientSecretEncrypted),
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

// src/modules/oidc/passwordGrant.service.ts (grounded against @types/oidc-provider's
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

// --- oidcProvider.factory.ts: createOidcProvider(...) (deliberately unclassed wiring) ---
// Verified end-to-end against the real library — this is what actually works, not a plan.
// An OidcModule async factory (inject: [ConfigService, repository token, ClientRepository,
// PasswordGrantService]) — no more app.get(...) from main.ts; Nest's DI resolves all of it.
async function createOidcProvider(configService, oidcModelRepository, clientRepository, passwordGrantService) {
  const { Provider } = await import('oidc-provider');   // ESM-only — see Risks
  const provider = new Provider(configService.get<string>(ENV.OIDC_ISSUER) ?? '…', {
    adapter: (modelName: string) => new OidcAdapter(modelName, oidcModelRepository, clientRepository),
    clients: [],                       // intentionally empty — see "Alternatives" below
    // 'offline_access' isn't a business scope (SUPPORTED_SCOPES is) — its mere presence is what
    // makes oidc-provider enable the 'refresh_token' grant TYPE at all (lib/helpers/configuration.js
    // collectGrantTypes()); omit it and every client declaring 'refresh_token' gets
    // invalid_client_metadata, since the provider itself never recognizes the grant. Found by
    // reading the library's source directly, not docs — see Risks.
    scopes: [...SUPPORTED_SCOPES, 'offline_access'],
    jwks,                              // REQ-9.1 — { keys: [...] }, read from src/secrets/private.jwk.json
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
  });
  // 'scope' MUST be listed here too — omitted, oidc-provider silently drops any caller-supplied
  // scope from ctx.oidc.params before the handler runs, so REQ-6.3 (invalid_scope) never fires
  // and the request quietly succeeds with the full allowed set instead. Found by a failing e2e
  // test (T17), not by reading docs — nothing flagged this as required.
  provider.registerGrantType('password', (ctx) => passwordGrantService.handle(ctx), ['username', 'password', 'scope']);
  return provider;   // OidcModule provides this under OIDC_PROVIDER; mounting is OidcController's job
}

// src/modules/oidc/oidc.controller.ts — a proper NestJS controller instead of raw app.use()
// middleware (an earlier approach, replaced — see Alternatives). Express 5 (this app's platform)
// uses path-to-regexp v8: a bare '/*' wildcard is invalid, needs a named one ('/*splat').
@Controller('oauth')
class OidcController {
  private readonly callback: (req: Request, res: Response) => Promise<void>;   // inherited from
                                                                                 // Koa — genuinely
                                                                                 // async, not void
  constructor(@Inject(OIDC_PROVIDER) provider: Provider) {
    this.callback = provider.callback();
  }
  @All('/*splat')
  async mounted(@Req() req: Request, @Res() res: Response): Promise<void> {
    req.url = req.originalUrl.replace('/oauth', '');
    await this.callback(req, res);   // -> POST /oauth/token, GET /oauth/jwks (REQ-9.2), etc.
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
4. Response returns the plaintext secret once; only the encrypted value is ever stored.

**Signup (REQ-2)**
1. `POST /users` with `{ username, password }`, authenticated as the
   owning client via `Authorization: Basic base64(clientId:clientSecret)`
   — the same credential shape `POST /oauth/token` uses.
2. `ClientAuthGuard` decodes the header, looks up the client via
   `ClientRepository`, decrypts its stored secret for comparison, and
   attaches `clientId` to the request (401 if the header is missing,
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
- Every access token, regardless of which grant issued it, is a JWT signed with the private key read from `src/secrets/private.jwk.json` at bootstrap (REQ-9.1). `oidc-provider` also derives the public half itself and serves it at `/oauth/jwks`; `src/secrets/public.jwk.json` is the same key handed directly to the frontend as a file rather than fetched live — either way satisfies REQ-9.2, a frontend (or any other party) verifies a token's origin independently, without ever calling back to this server. Refresh tokens are never JWTs (REQ-9.3) — rotation (REQ-5.4) and revocation still go through `OidcAdapter` as opaque references.

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

### Storing client secrets bcrypt-hashed, same as user passwords

Rejected, resolved during T14 (was flagged as an open Risk until then).
`oidc-provider`'s default `client_secret_basic`/`client_secret_post`
authentication does a direct comparison against the Client metadata's
`client_secret` field, which a one-way hash can't satisfy — confirmed
by checking the library's own docs for a hashed-secret hook (none
documented: no `compareClientSecret` callback, no override point for
symmetric-secret verification, only `clientAuthMethods` to pick which
methods are *enabled*). Patching/forking the library to add one was
the only way to keep bcrypt-hashing, and was rejected as disproportionate
for a reference implementation. **Adopted instead: reversible
encryption-at-rest** (AES-256-GCM, `src/utils/secretCipher.util.ts`,
keyed by `CLIENT_SECRET_ENCRYPTION_KEY`) — `ClientEntity.clientSecretEncrypted`
is decrypted back to plaintext inside `OidcAdapter`'s `Client`
mapping before being handed to the library, so its built-in comparison
works unmodified. Trade-off, accepted deliberately: a compromised
`CLIENT_SECRET_ENCRYPTION_KEY` exposes every stored client secret,
unlike a one-way hash — acceptable here because the alternative was
forking a third-party library for a teaching reference implementation.

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
`OidcController` (`@Controller('oauth')`, `@All('/*splat')`) now owns
mounting instead, injecting `OIDC_PROVIDER` (moved into `OidcModule`'s
DI graph as an async factory) rather than `main.ts` calling `app.get(...)`
manually after the fact. Functionally identical; consistent with every
other REST-facing piece staying inside Nest's controller system was the
actual reason to change it. Required knowing Express 5 (this app's
platform) uses path-to-regexp v8, where a bare `'/*'` wildcard — valid
in Express 4 examples — is rejected; the fix is a named wildcard
(`'/*splat'`).

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
`POST /users` gated by `ClientAuthGuard` and its own Basic-auth check.
Rejected on reflection because it let anyone who merely *knew* (or
guessed/enumerated) a valid `client_id` create users under a client they
had no other relationship to — the client's identifier alone was never
meant to be a secret, so anything gated only by it isn't gated at all.
`ClientAuthGuard` requires the *secret* too, the same credential pair
`POST /oauth/token` already requires, so a caller can only create users
under a client it can actually authenticate as. Still satisfies REQ-2.1
("providing that client's identifier") — the identifier is still
provided, as the Basic-auth username half, just no longer trusted
unauthenticated. `UserService.create()`'s own `NotFoundException` for an
unknown client is effectively dead code from this one HTTP path now
(the guard already guarantees the client exists by the time the service
runs) but is left in place, since the service method has its own
contract independent of which controller happens to call it today.

## Requirement coverage

"OidcProviderModule" below refers collectively to `OidcModule` (the Nest
provider registrations, including the `OIDC_PROVIDER` async factory),
`oidcProvider.factory.ts` (`createOidcProvider(...)`, the actual
`Provider` construction), and `OidcController` (mounts it) — three
files, not one literal `OidcProviderModule.ts`.

| REQ ID | Covered by |
|---|---|
| REQ-1.1 | `Client` module (`ClientService`, `ClientRepository`) |
| REQ-1.2 | `Client` module |
| REQ-1.3 | AdminGuard |
| REQ-2.1 | `User` module (`UserService`, `UserRepository`) + `ClientAuthGuard` (client identity via Basic auth, not an unauthenticated path param) |
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
| REQ-9.1 | Signing key pair (`src/secrets/private.jwk.json`) + OidcProviderModule (`jwks` + `features.resourceIndicators`) |
| REQ-9.2 | OidcProviderModule (native `/jwks` route) + `src/secrets/public.jwk.json` (handed directly to the frontend) |
| REQ-9.3 | OidcProviderModule (native library behavior — refresh tokens never go through `resourceIndicators`) |

Uncovered requirements: none.

## Risks

- **Resolved: client secret storage vs. `oidc-provider`'s built-in
  auth.** See the "Storing client secrets bcrypt-hashed" alternative
  above — resolved as reversible AES-256-GCM encryption, decrypted
  inside `OidcAdapter`'s `Client` mapping (T14). The residual
  risk is operational, not architectural: `CLIENT_SECRET_ENCRYPTION_KEY`
  is a plain env var for now, with no rotation story — if it's ever
  rotated, every stored client secret becomes undecryptable unless
  re-encrypted first.
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
- **Unused routes still mounted.** `provider.callback()` mounts the
  library's full route set (including the authorization endpoint), even
  though this design never drives a user through it (no consent UI,
  Authorization Code excluded). Worth confirming those routes fail
  closed rather than becoming unreviewed surface area.
- **Signing key rotation is still unaddressed.** Where the key pair
  lives is settled (two plain files in `src/secrets/`), but not whether
  it's ever rotated — a new key pair issued while tokens signed with the
  old one are still valid needs multiple keys active in the JWKS at once
  (`kid`-keyed), which a single `private.jwk.json` doesn't accommodate.
  Carried from requirements.md's open questions.
- **Real private key material living in the repo tree.** Committing
  `src/secrets/private.jwk.json` as a literal file is the simplest thing
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
  `src/secrets/{private,public}.jwk.json` — this is a setup script/ops
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
  `supportedScopes.constant.ts`) sufficient to unblock T16 — not a full
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
  (`resource: DEFAULT_RESOURCE` in its constructor properties) so a
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
