import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClientService } from '../src/modules/client/client.service';
import { UserService } from '../src/modules/user/user.service';

describe('Resource Owner Password Credentials grant (e2e)', () => {
  let app: INestApplication;
  let clientAId: string;
  let clientASecret: string;
  let clientBId: string;
  let clientBSecret: string;

  function basicAuth(id: string, secret: string): string {
    return Buffer.from(`${id}:${secret}`).toString('base64');
  }

  function tokenRequest(clientId: string, clientSecret: string, body: string) {
    return request(app.getHttpServer())
      .post('/oauth/token')
      .set('Authorization', `Basic ${basicAuth(clientId, clientSecret)}`)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(body);
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

    const clientService = moduleRef.get(ClientService);
    const userService = moduleRef.get(UserService);

    const clientA = await clientService.create('Password Grant Client A', [
      'read',
      'write',
    ]);
    clientAId = clientA.client.id;
    clientASecret = clientA.plainSecret;
    await userService.signup(clientAId, 'alice', 'correct-password');

    const clientB = await clientService.create('Password Grant Client B', [
      'read',
    ]);
    clientBId = clientB.client.id;
    clientBSecret = clientB.plainSecret;
    // Same username as under client A, but a distinct, unrelated user (REQ-2.2).
    await userService.signup(clientBId, 'alice', 'a-different-password');
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues an access + refresh token for correct credentials (REQ-3.1, REQ-3.4)', async () => {
    const response = await tokenRequest(
      clientAId,
      clientASecret,
      'grant_type=password&username=alice&password=correct-password',
    ).expect(200);

    const body = response.body as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      scope: string;
    };

    expect(body.access_token.split('.')).toHaveLength(3); // REQ-9.1 — a real JWT
    expect(body.refresh_token.split('.')).toHaveLength(1); // REQ-9.3 — always opaque
    expect(body.token_type.toLowerCase()).toBe('bearer');
    expect(body.scope).toBe('read write'); // full inheritance, REQ-2.4/REQ-6.2
  });

  it('rejects a wrong password with invalid_grant (REQ-3.3)', async () => {
    const response = await tokenRequest(
      clientAId,
      clientASecret,
      'grant_type=password&username=alice&password=wrong-password',
    ).expect(400);

    expect((response.body as { error: string }).error).toBe('invalid_grant');
  });

  it("rejects a user's credentials submitted against a different client (REQ-3.2)", async () => {
    // alice's password under client A must not authenticate against client B,
    // even though a same-named user exists there with a different password.
    const response = await tokenRequest(
      clientBId,
      clientBSecret,
      'grant_type=password&username=alice&password=correct-password',
    ).expect(400);

    expect((response.body as { error: string }).error).toBe('invalid_grant');
  });

  it('rejects a requested scope outside the allowed set with invalid_scope (REQ-6.3)', async () => {
    // client B's allowedScopes is only ['read'].
    const response = await tokenRequest(
      clientBId,
      clientBSecret,
      'grant_type=password&username=alice&password=a-different-password&scope=read%20write',
    ).expect(400);

    expect((response.body as { error: string }).error).toBe('invalid_scope');
  });
});
