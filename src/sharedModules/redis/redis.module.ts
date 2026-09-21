import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConfig } from '@config/redis.config';
import { REDIS_CLIENT } from './redis.constants';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Redis(redisConfig(configService)),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  // An open connection keeps the event loop alive, so without this `app.close()`
  // returns but the process never exits — an e2e run hangs after its last test.
  async onApplicationShutdown(): Promise<void> {
    await this.redisClient.quit();
  }
}
