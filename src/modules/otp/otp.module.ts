import { Module } from '@nestjs/common';
import { RedisModule } from '../../sharedModules/redis/redis.module';
import { OtpRepository } from './otp.repository';

@Module({
  imports: [RedisModule],
  providers: [OtpRepository],
  exports: [OtpRepository],
})
export class OtpModule {}
