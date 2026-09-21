import { ClientService } from '../../modules/client/client.service';
import { ClientRepository } from '../../modules/client/client.repository';
import { ClientEntity } from '../../modules/client/client.entity';

describe('ClientService', () => {
  function buildService() {
    const saveMock = jest.fn((client: ClientEntity) => Promise.resolve(client));
    const clientRepository = {
      save: saveMock,
      findByClientId: jest.fn(),
    } as unknown as ClientRepository;
    return {
      service: new ClientService(clientRepository),
      saveMock,
    };
  }

  let service: ClientService;
  let saveMock: ReturnType<typeof buildService>['saveMock'];

  beforeEach(() => {
    ({ service, saveMock } = buildService());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates and persists a client with a generated secret (REQ-1.1, REQ-1.2)', async () => {
    const { client, plainSecret } = await service.create('My Client', [
      'read',
      'write',
    ]);

    expect(saveMock).toHaveBeenCalledWith(client);
    expect(client.name).toBe('My Client');
    expect(client.allowedScopes).toEqual(['read', 'write']);
    expect(plainSecret).toEqual(expect.any(String));
    expect(client.clientSecret).toBe(plainSecret);
  });

  it('generates a unique id/secret per call (REQ-1.2)', async () => {
    const first = await service.create('A', ['read']);
    const second = await service.create('B', ['read']);

    expect(first.client.id).not.toBe(second.client.id);
    expect(first.plainSecret).not.toBe(second.plainSecret);
  });
});
