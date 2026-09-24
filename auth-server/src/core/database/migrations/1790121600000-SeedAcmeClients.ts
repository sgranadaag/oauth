import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_GRANT_TYPES } from '@modules/client/client.constants';
import { ClientEntity } from '@modules/client/client.entity';
import { CLIENT_CREDENTIALS_GRANT_TYPE } from '@modules/oauth/flows/tokenExchange/grant.constants';
import { UserEntity } from '@modules/user/user.entity';
import { hashPassword } from '@modules/user/user.util';

const SCOPES = ['read', 'write'];

const WEB_CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const BACKEND_CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const BACKEND_CLIENT_SECRET = '33333333-3333-4333-8333-333333333333';

const PASSWORD = 'password';
const EMAIL = 'alice@acme.test';

export class SeedAcmeClients1790121600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const clients = queryRunner.connection.getMongoRepository(ClientEntity);
    const users = queryRunner.connection.getMongoRepository(UserEntity);

    const web = new ClientEntity();
    web.id = WEB_CLIENT_ID;
    web.name = 'ACME Web';
    web.clientSecret = '';
    web.isPublic = true;
    web.allowedScopes = SCOPES;
    web.redirectUris = ['http://localhost:3001/callback'];
    web.grantTypes = DEFAULT_GRANT_TYPES;
    web.accessTokenTtlSeconds = null;

    const existingWeb = await clients.findOneBy({ id: WEB_CLIENT_ID });
    if (!existingWeb) await clients.save(web);

    const backend = new ClientEntity();
    backend.id = BACKEND_CLIENT_ID;
    backend.name = 'ACME Backend';
    backend.clientSecret = BACKEND_CLIENT_SECRET;
    backend.isPublic = false;
    backend.allowedScopes = SCOPES;
    backend.redirectUris = [];
    backend.grantTypes = [CLIENT_CREDENTIALS_GRANT_TYPE];
    backend.accessTokenTtlSeconds = null;

    const existingBackend = await clients.findOneBy({ id: BACKEND_CLIENT_ID });
    if (!existingBackend) await clients.save(backend);

    const accounts = [
      { id: '44444444-4444-4444-8444-444444444444', clientId: WEB_CLIENT_ID },
      { id: '55555555-5555-4555-8555-555555555555', clientId: BACKEND_CLIENT_ID },
    ];

    for (const account of accounts) {
      const existing = await users.findOneBy({
        clientId: account.clientId,
        email: EMAIL,
      });
      if (existing) continue;

      const user = new UserEntity();
      user.id = account.id;
      user.clientId = account.clientId;
      user.email = EMAIL;
      user.passwordHash = await hashPassword(PASSWORD);

      await users.save(user);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const clients = queryRunner.connection.getMongoRepository(ClientEntity);
    const users = queryRunner.connection.getMongoRepository(UserEntity);

    await users.deleteMany({
      clientId: { $in: [WEB_CLIENT_ID, BACKEND_CLIENT_ID] },
    });
    await clients.deleteMany({
      id: { $in: [WEB_CLIENT_ID, BACKEND_CLIENT_ID] },
    });
  }
}
