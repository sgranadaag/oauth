import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ClientService } from '../../src/modules/client/client.service';

describe('User (e2e)', () => {
  let app: INestApplication;
  let clientService: ClientService;
  let clientId: string;
  let clientSecret: string;

  function basicAuth(id: string, secret: string): string {
    return Buffer.from(`${id}:${secret}`).toString('base64');
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    clientService = moduleRef.get(ClientService);
    const { client, plainSecret } = await clientService.create(
      'User e2e Client',
      ['read', 'write'],
    );
    clientId = client.id;
    clientSecret = plainSecret;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects signup with no client credentials', async () => {
    await request(app.getHttpServer())
      .post('/users/signup')
      .send({ username: 'alice', password: 'super-secret' })
      .expect(401);
  });

  it('rejects signup with the wrong client secret', async () => {
    await request(app.getHttpServer())
      .post('/users/signup')
      .set('Authorization', `Basic ${basicAuth(clientId, 'wrong-secret')}`)
      .send({ username: 'alice', password: 'super-secret' })
      .expect(401);
  });

  it('signs a user up under the authenticated client (REQ-2.1, REQ-2.3, REQ-2.4)', async () => {
    const response = await request(app.getHttpServer())
      .post('/users/signup')
      .set('Authorization', `Basic ${basicAuth(clientId, clientSecret)}`)
      .send({ username: 'alice', password: 'super-secret' })
      .expect(201);

    const body = response.body as {
      id: string;
      username: string;
      scopes: string[];
    };

    expect(body.username).toBe('alice');
    expect(body.scopes).toEqual(['read', 'write']);
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate username under the same client (REQ-2.2)', async () => {
    await request(app.getHttpServer())
      .post('/users/signup')
      .set('Authorization', `Basic ${basicAuth(clientId, clientSecret)}`)
      .send({ username: 'bob', password: 'super-secret' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/users/signup')
      .set('Authorization', `Basic ${basicAuth(clientId, clientSecret)}`)
      .send({ username: 'bob', password: 'different-secret' })
      .expect(409);
  });

  it('allows the same username under a different client (REQ-2.2)', async () => {
    const { client: otherClient, plainSecret: otherSecret } =
      await clientService.create('Other e2e Client', ['read']);

    await request(app.getHttpServer())
      .post('/users/signup')
      .set('Authorization', `Basic ${basicAuth(otherClient.id, otherSecret)}`)
      .send({ username: 'alice', password: 'super-secret' })
      .expect(201);
  });
});
