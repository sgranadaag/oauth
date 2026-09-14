import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ClientRepository } from '../../src/modules/client/client.repository';

describe('Client (e2e)', () => {
  let app: INestApplication;
  let clientRepository: ClientRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    clientRepository = moduleRef.get(ClientRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects client creation without the admin credential (REQ-1.3)', async () => {
    await request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'No Auth', allowedScopes: ['read'] })
      .expect(401);
  });

  it('rejects client creation with the wrong admin credential (REQ-1.3)', async () => {
    await request(app.getHttpServer())
      .post('/clients')
      .set('x-admin-key', 'wrong-key')
      .send({ name: 'Wrong Auth', allowedScopes: ['read'] })
      .expect(401);
  });

  it('creates a client with the correct admin credential (REQ-1.1, REQ-1.2)', async () => {
    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('x-admin-key', process.env.ADMIN_API_KEY as string)
      .send({ name: 'Real Client', allowedScopes: ['read', 'write'] })
      .expect(201);

    const body = response.body as {
      clientId: string;
      clientSecret: string;
      name: string;
      allowedScopes: string[];
    };

    expect(body).toMatchObject({
      name: 'Real Client',
      allowedScopes: ['read', 'write'],
    });
    expect(body.clientId).toEqual(expect.any(String));
    expect(body.clientSecret).toEqual(expect.any(String));

    // The secret is stored exactly as issued, so the returned value is what a
    // later token request will be compared against.
    const stored = await clientRepository.findByClientId(body.clientId);
    expect(stored?.clientSecret).toBe(body.clientSecret);
  });
});
