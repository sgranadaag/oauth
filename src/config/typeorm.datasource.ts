import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENV } from '@constants/environment.constant';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env[ENV.DATABASE_HOST],
  port: Number(process.env[ENV.DATABASE_PORT]),
  username: process.env[ENV.DATABASE_USER],
  password: process.env[ENV.DATABASE_PASSWORD],
  database: process.env[ENV.DATABASE_NAME],
  entities: ['src/modules/**/*.entity.ts'],
  migrations: ['src/migrations/postgres/*.ts'],
});
