import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ENV } from '@constants/environment.constant';

export function mongoConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'mongodb',
    url: configService.get<string>(ENV.MONGO_URI),
    database: configService.get<string>(ENV.MONGO_DATABASE),
    autoLoadEntities: true,
    // On MongoDB this is not the destructive schema sync it is on Postgres:
    // collections are schemaless, so TypeORM only creates the declared indexes
    // (`@Index`) of the entities registered here: `clients`, `tokens`,
    // `authorization_requests`, `authorization_codes` and `users`.
    synchronize: true,
  };
}
