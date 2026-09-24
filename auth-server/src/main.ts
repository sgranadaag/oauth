import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ENV } from '@core/config/env.config';
import { setupSwagger } from '@core/config/swagger.config';
import { DEFAULT_CORS_ORIGINS } from '@core/config/cors.config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: (configService.get<string>(ENV.CORS_ORIGINS) ?? DEFAULT_CORS_ORIGINS).split(','),
    credentials: true,
  });

  setupSwagger(app);

  await app.listen(configService.get<string>(ENV.PORT) ?? 3000);
}
void bootstrap();
