import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClientService } from '../src/modules/client/client.service';
import { UserService } from '../src/modules/user/user.service';

describe('Refresh Token grant (e2e)', () => {
  let app: INestApplication;
  let clientId: string;
  let clientSecret: string;

  function basicAuth(): string {
    return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  }

  function tokenRequest(body: string) {
    return request(app.getHttpServer())
      .post('/oauth/token')
      .set('Authorization', `Basic ${basicAuth()}`)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(body);
  }

  async function obtainInitialRefreshToken(): Promise<string> {
    const response = await tokenRequest(
      'grant_type=password&username=alice&password=correct-password',
    ).expect(200);
    return (response.body as { refresh_token: string }).refresh_token;
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

    const { client, plainSecret } = await clientService.create(
      'Refresh Grant Client',
      ['read', 'write'],
    );
    clientId = client.id;
    clientSecret = plainSecret;
    await userService.signup(clientId, 'alice', 'correct-password');
  });

  afterAll(async () => {
    await app.close();
  });

  it('exchanges a refresh token for a new access + refresh token (REQ-5.1)', async () => {
    const refreshToken = await obtainInitialRefreshToken();

    const response = await tokenRequest(
      `grant_type=refresh_token&refresh_token=${refreshToken}`,
    ).expect(200);

    const body = response.body as {
      access_token: string;
      refresh_token: string;
    };
    expect(body.access_token.split('.')).toHaveLength(3); // still a JWT (REQ-9.1)
    expect(body.refresh_token).toEqual(expect.any(String));
    expect(body.refresh_token).not.toBe(refreshToken); // rotated — a new token, not the same one
  });

  it('rotates on use: reusing an already-consumed refresh token is rejected (REQ-5.4)', async () => {
    const refreshToken = await obtainInitialRefreshToken();

    // First use succeeds and consumes it.
    await tokenRequest(
      `grant_type=refresh_token&refresh_token=${refreshToken}`,
    ).expect(200);

    // Reusing the same (now-consumed) refresh token must fail.
    const response = await tokenRequest(
      `grant_type=refresh_token&refresh_token=${refreshToken}`,
    ).expect(400);

    expect((response.body as { error: string }).error).toBe('invalid_grant');
  });

  it('rejects an invalid/unknown refresh token (REQ-5.2)', async () => {
    const response = await tokenRequest(
      'grant_type=refresh_token&refresh_token=not-a-real-token',
    ).expect(400);

    expect((response.body as { error: string }).error).toBe('invalid_grant');
  });

  it('rejects a refresh request asking for a wider scope than the original grant (REQ-5.3)', async () => {
    // Request a narrower initial grant (just "read", not the client's full "read write")
    // so there's a real "wider than what was actually granted" case to test against —
    // both "read" and "write" are globally supported (SUPPORTED_SCOPES), so this isn't
    // conflatable with the separate "scope not recognized at all" failure mode.
    const initialResponse = await tokenRequest(
      'grant_type=password&username=alice&password=correct-password&scope=read',
    ).expect(200);
    const narrowRefreshToken = (
      initialResponse.body as { refresh_token: string }
    ).refresh_token;

    const response = await tokenRequest(
      `grant_type=refresh_token&refresh_token=${narrowRefreshToken}&scope=read%20write`,
    ).expect(400);

    expect((response.body as { error: string }).error).toBe('invalid_scope');
  });
});
