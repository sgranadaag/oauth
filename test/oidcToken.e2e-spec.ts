import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClientService } from '../src/modules/client/client.service';

describe('OIDC token endpoint (e2e)', () => {
  let app: INestApplication;
  let clientId: string;
  let clientSecret: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const clientService = moduleRef.get(ClientService);
    const { client, plainSecret } = await clientService.create(
      'Token e2e Client',
      ['read', 'write'],
    );
    clientId = client.id;
    clientSecret = plainSecret;
  });

  afterAll(async () => {
    await app.close();
  });

  function basicAuth(): string {
    return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  }

  it('issues a JWT access token for client_credentials, with no refresh_token (REQ-4.1, REQ-4.3, REQ-9.1)', async () => {
    const response = await request(app.getHttpServer())
      .post('/oauth/token')
      .set('Authorization', `Basic ${basicAuth()}`)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('grant_type=client_credentials')
      .expect(200);

    const body = response.body as {
      access_token: string;
      token_type: string;
      refresh_token?: string;
    };

    expect(body.access_token).toEqual(expect.any(String));
    expect(body.access_token.split('.')).toHaveLength(3); // REQ-9.1 — a real JWT, not opaque
    expect(body.token_type.toLowerCase()).toBe('bearer');
    expect(body.refresh_token).toBeUndefined(); // REQ-4.3
  });

  it('rejects invalid client credentials with invalid_client (REQ-4.2)', async () => {
    const response = await request(app.getHttpServer())
      .post('/oauth/token')
      .set(
        'Authorization',
        `Basic ${Buffer.from(`${clientId}:wrong-secret`).toString('base64')}`,
      )
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('grant_type=client_credentials')
      .expect(401);

    expect((response.body as { error: string }).error).toBe('invalid_client');
  });

  it('rejects an unsupported grant_type (REQ-8.2)', async () => {
    const response = await request(app.getHttpServer())
      .post('/oauth/token')
      .set('Authorization', `Basic ${basicAuth()}`)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('grant_type=not_a_real_grant')
      .expect(400);

    expect((response.body as { error: string }).error).toBe(
      'unsupported_grant_type',
    );
  });

  it('publishes only public key material at /oauth/jwks (REQ-9.2)', async () => {
    const response = await request(app.getHttpServer())
      .get('/oauth/jwks')
      .expect(200);

    const body = response.body as { keys: Record<string, unknown>[] };
    expect(body.keys.length).toBeGreaterThan(0);
    for (const key of body.keys) {
      expect(key).not.toHaveProperty('d');
      expect(key).not.toHaveProperty('p');
      expect(key).not.toHaveProperty('q');
    }
  });
});
