import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from '@modules/user/user.service';
import { UserRepository } from '@modules/user/user.repository';
import { UserEntity } from '@modules/user/user.entity';
import { ClientRepository } from '@modules/client/client.repository';
import { ClientEntity } from '@modules/client/client.entity';

describe('UserService', () => {
  function buildClient(): ClientEntity {
    const client = new ClientEntity();
    client.id = 'client-1';
    client.clientSecret = 'secret';
    client.name = 'My Client';
    client.allowedScopes = ['read', 'write'];
    return client;
  }

  function buildExistingUser(): UserEntity {
    const user = new UserEntity();
    user.id = 'existing-user';
    user.clientId = 'client-1';
    user.username = 'alice';
    user.passwordHash = 'existing-hash';
    return user;
  }

  function buildService(
    client: ClientEntity | null,
    existingUser: UserEntity | null = null,
  ) {
    const saveMock = jest.fn((user: UserEntity) => Promise.resolve(user));
    const userRepository = {
      save: saveMock,
      findByClientAndUsername: jest.fn(() => Promise.resolve(existingUser)),
    } as unknown as UserRepository;
    const clientRepository = {
      save: jest.fn(),
      findByClientId: jest.fn(() => Promise.resolve(client)),
    } as unknown as ClientRepository;
    return {
      service: new UserService(userRepository, clientRepository),
      saveMock,
    };
  }

  let client: ClientEntity;
  let existingUser: UserEntity;

  beforeEach(() => {
    client = buildClient();
    existingUser = buildExistingUser();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs up a user under an existing client (REQ-2.1)', async () => {
    const { service, saveMock } = buildService(client);

    const { user, allowedScopes } = await service.signup(
      'client-1',
      'alice',
      'plain-password',
    );

    expect(saveMock).toHaveBeenCalledWith(user);
    expect(user.username).toBe('alice');
    expect(user.passwordHash).not.toBe('plain-password');
    expect(allowedScopes).toEqual(['read', 'write']);
  });

  it('rejects signup under an unknown client', async () => {
    const { service } = buildService(null);

    await expect(
      service.signup('missing-client', 'alice', 'plain-password'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a duplicate username under the same client (REQ-2.2)', async () => {
    client.allowedScopes = ['read'];
    const { service, saveMock } = buildService(client, existingUser);

    await expect(
      service.signup('client-1', 'alice', 'plain-password'),
    ).rejects.toThrow(ConflictException);
    expect(saveMock).not.toHaveBeenCalled();
  });
});
