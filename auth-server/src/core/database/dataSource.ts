import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ENV } from '@core/config/env.config';

loadEnv();

// The running app never touches this: Nest builds its own DataSource from
// mongoConfig() through ConfigService. This one exists because the TypeORM
// CLI has no Nest container to ask, and `migration:run` needs a DataSource it
// can import by itself.
export default new DataSource({
  type: 'mongodb',
  url: process.env[ENV.MONGO_URI],
  database: process.env[ENV.MONGO_DATABASE],
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/core/database/migrations/*.ts'],
});
