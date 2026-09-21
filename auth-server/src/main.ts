import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ENV } from '@constants/environment.constant';
import { setupSwagger } from '@config/swagger.config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  setupSwagger(app);

  const configService = app.get(ConfigService);
  await app.listen(configService.get<string>(ENV.PORT) ?? 3000);
}
void bootstrap();
