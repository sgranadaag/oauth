import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@global/redis/redis.constants';
import { OTP_KEY_PREFIX, OTP_TTL_SECONDS } from './otp.constants';

@Injectable()
export class OtpRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async save(userId: string, otp: string): Promise<void> {
    await this.redisClient.set(
      this.buildKey(userId),
      otp,
      'EX',
      OTP_TTL_SECONDS,
    );
  }

  find(userId: string): Promise<string | null> {
    return this.redisClient.get(this.buildKey(userId));
  }

  async delete(userId: string): Promise<boolean> {
    const deletedCount = await this.redisClient.del(this.buildKey(userId));
    return deletedCount === 1;
  }

  private buildKey(userId: string): string {
    return `${OTP_KEY_PREFIX}:${userId}`;
  }
}
