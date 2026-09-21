import { ClientController } from '../../modules/client/client.controller';
import { ClientService } from '../../modules/client/client.service';
import { ClientEntity } from '../../modules/client/client.entity';
import { CreateClientDto } from '../../modules/client/dto/createClient.dto';

describe('ClientController', () => {
  const PLAIN_SECRET = 'plain-secret-returned-once';

  function buildClient(): ClientEntity {
    const client = new ClientEntity();
    client.id = 'client-1';
    client.clientSecret = 'the-issued-secret';
    client.name = 'My Client';
    client.allowedScopes = ['read', 'write'];
    return client;
  }

  function buildController(client: ClientEntity) {
    const createMock = jest.fn(() =>
      Promise.resolve({ client, plainSecret: PLAIN_SECRET }),
    );
    const clientService = { create: createMock } as unknown as ClientService;
    return { controller: new ClientController(clientService), createMock };
  }

  let client: ClientEntity;
  let controller: ClientController;
  let createMock: ReturnType<typeof buildController>['createMock'];
  let dto: CreateClientDto;

  beforeEach(() => {
    client = buildClient();
    ({ controller, createMock } = buildController(client));
    dto = { name: 'My Client', allowedScopes: ['read', 'write'] };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes the DTO fields through to ClientService (REQ-1.1)', async () => {
    await controller.create(dto);

    expect(createMock).toHaveBeenCalledWith('My Client', ['read', 'write']);
  });

  it('returns the issued credentials in the response DTO (REQ-1.2)', async () => {
    const response = await controller.create(dto);

    expect(response).toMatchObject({
      clientId: 'client-1',
      clientSecret: PLAIN_SECRET,
      name: 'My Client',
      allowedScopes: ['read', 'write'],
    });
  });
});
