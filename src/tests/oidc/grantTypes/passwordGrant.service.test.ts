import * as bcrypt from 'bcryptjs';
import type { KoaContextWithOIDC } from 'oidc-provider';
import { PasswordGrantService } from '@modules/oidc/grantTypes/passwordGrant.service';
import type { OidcErrors } from '@modules/oidc/oidc.interfaces';
import { UserRepository } from '@modules/user/user.repository';
import { UserEntity } from '@modules/user/user.entity';
import { ClientRepository } from '@modules/client/client.repository';
import { ClientEntity } from '@modules/client/client.entity';

class StubInvalidGrant extends Error {}
class StubInvalidScope extends Error {}

const stubErrors = {
  InvalidGrant: StubInvalidGrant,
  InvalidScope: StubInvalidScope,
} as unknown as OidcErrors;

class StubGrant {
  jti = 'grant-jti';
  addedScope: string[] = [];
  addedResourceScope?: { resource: string; scope: string[] };
  addOIDCScope(scope: string[]) {
    this.addedScope = scope;
  }
  addResourceScope(resource: string, scope: string[]) {
    this.addedResourceScope = { resource, scope };
  }
  save() {
    return Promise.resolve(this.jti);
  }
}

class StubAccessToken {
  expiration = 3600;
  constructor(public props: Record<string, unknown>) {}
  save() {
    return Promise.resolve('stub-access-token');
  }
}

class StubRefreshToken {
  constructor(public props: Record<string, unknown>) {}
  save() {
    return Promise.resolve('stub-refresh-token');
  }
}

class StubResourceServer {
  constructor(
    public identifier: string,
    public data: Record<string, unknown>,
  ) {}
}

function buildProvider() {
  return {
    Grant: StubGrant,
    AccessToken: StubAccessToken,
    RefreshToken: StubRefreshToken,
    ResourceServer: StubResourceServer,
  };
}

function buildContext(
  params: Record<string, unknown>,
  provider: ReturnType<typeof buildProvider>,
): KoaContextWithOIDC {
  const entities: Record<string, unknown> = {};
  return {
    oidc: {
      params,
      client: { clientId: 'client-1' },
      provider,
      entity: (key: string, value: unknown) => {
        entities[key] = value;
      },
    },
    body: undefined,
  } as unknown as KoaContextWithOIDC;
}

function buildClient(overrides: Partial<ClientEntity> = {}): ClientEntity {
  const client = new ClientEntity();
  client.id = 'client-1';
  client.clientSecret = 'secret';
  client.name = 'Client';
  client.allowedScopes = ['read'];
  return Object.assign(client, overrides);
}

function buildUser(passwordHash: string): UserEntity {
  const user = new UserEntity();
  user.id = 'user-1';
  user.clientId = 'client-1';
  user.username = 'alice';
  user.passwordHash = passwordHash;
  return user;
}

describe('PasswordGrantService', () => {
  function buildService(client: ClientEntity | null, user: UserEntity | null) {
    const userRepository = {
      save: jest.fn(),
      findByClientAndUsername: jest.fn(() => Promise.resolve(user)),
    } as unknown as UserRepository;
    const clientRepository = {
      save: jest.fn(),
      findByClientId: jest.fn(() => Promise.resolve(client)),
    } as unknown as ClientRepository;
    return new PasswordGrantService(
      userRepository,
      clientRepository,
      stubErrors,
    );
  }

  let client: ClientEntity;
  let user: UserEntity;
  let provider: ReturnType<typeof buildProvider>;

  beforeEach(async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    client = buildClient();
    user = buildUser(passwordHash);
    provider = buildProvider();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects invalid credentials with InvalidGrant (REQ-3.3)', async () => {
    const service = buildService(null, null);
    const ctx = buildContext({ username: 'alice', password: 'wrong' }, provider);

    await expect(service.handle(ctx)).rejects.toBeInstanceOf(StubInvalidGrant);
  });

  it('rejects a requested scope outside the client allowedScopes with InvalidScope (REQ-6.3)', async () => {
    client.allowedScopes = ['read'];
    const service = buildService(client, user);
    const ctx = buildContext(
      { username: 'alice', password: 'correct-password', scope: 'read write' },
      provider,
    );

    await expect(service.handle(ctx)).rejects.toBeInstanceOf(StubInvalidScope);
  });

  it('issues an access + refresh token for valid credentials (REQ-3.1, REQ-3.4, REQ-6.1, REQ-6.2)', async () => {
    client.allowedScopes = ['read', 'write'];
    const service = buildService(client, user);
    const ctx = buildContext(
      { username: 'alice', password: 'correct-password' },
      provider,
    );

    await service.handle(ctx);

    expect(ctx.body).toMatchObject({
      access_token: 'stub-access-token',
      refresh_token: 'stub-refresh-token',
      token_type: 'Bearer',
      scope: 'read write',
    });
  });
});
