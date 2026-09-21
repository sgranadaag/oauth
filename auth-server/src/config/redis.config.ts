import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';
import { ENV } from '@constants/environment.constant';

export function redisConfig(configService: ConfigService): RedisOptions {
  return {
    host: configService.get<string>(ENV.REDIS_HOST),
    port: Number(configService.get<string>(ENV.REDIS_PORT)),
  };
}
