import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export const ADMIN_KEY_SECURITY = 'adminKey';
export const CLIENT_BASIC_SECURITY = 'clientBasic';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('OAuth 2.0 Authorization Server')
    .setDescription(
      'RFC 6749 authorization server and OpenID Connect provider, ' +
        'implemented from scratch. The token endpoint serves the ' +
        'Authorization Code, Client Credentials and Refresh Token ' +
        'grants. `/users` is the identity side — the accounts and their ' +
        'password hashes — and nothing in `/oauth` calls it: the login app ' +
        'does, and then presents the result.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-admin-key',
        in: 'header',
        description:
          'The provider credential (ADMIN_API_KEY): registering clients, the ' +
          'interaction endpoints and checking credentials. The login app ' +
          'presents it too.',
      },
      ADMIN_KEY_SECURITY,
    )
    .addBasicAuth(
      {
        type: 'http',
        scheme: 'basic',
        description:
          'Client credentials as `client_id:client_secret`, the same pair the ' +
          'token endpoint accepts.',
      },
      CLIENT_BASIC_SECURITY,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
