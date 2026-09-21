import {
  DynamicModule,
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import type { RedisModuleAsyncOptions } from './interfaces/redisModule.interface';

@Global()
@Module({})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  static forRootAsync({
    imports,
    inject,
    useFactory,
  }: RedisModuleAsyncOptions): DynamicModule {
    return {
      module: RedisModule,
      imports,
      providers: [
        {
          provide: REDIS_CLIENT,
          inject,
          useFactory: async (...args: any[]) =>
            new Redis(await useFactory(...args)),
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redisClient.quit();
  }
}
