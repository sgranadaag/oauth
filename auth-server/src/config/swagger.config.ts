import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export const ADMIN_KEY_SECURITY = 'adminKey';
export const CLIENT_BASIC_SECURITY = 'clientBasic';
export const BEARER_SECURITY = 'bearer';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('OAuth 2.0 Authorization Server')
    .setDescription(
      'RFC 6749 authorization server, implemented from scratch. The token ' +
        'endpoint serves the Resource Owner Password Credentials and OTP ' +
        'grants today; Client Credentials and Refresh Token are not ' +
        'implemented yet.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-admin-key',
        in: 'header',
        description: 'Bootstrap admin credential (ADMIN_API_KEY).',
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
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'An access token issued by this server. Verified offline against ' +
          'the published public key.',
      },
      BEARER_SECURITY,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
