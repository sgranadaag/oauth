import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mongoConfig } from '@config/mongo.config';
import { redisConfig } from '@config/redis.config';
import { RedisModule } from '@global/redis/redis.module';
import { RequestLoggerMiddleware } from '@middlewares/requestLogger.middleware';
import { ClientModule } from './modules/client/client.module';
import { UserModule } from './modules/user/user.module';
import { OauthModule } from './modules/oauth/oauth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: mongoConfig,
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: redisConfig,
    }),
    ClientModule,
    UserModule,
    OauthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // '*splat', not '*': Nest hands the path straight to Express 5's
    // `app.use`, and path-to-regexp 8 rejects an unnamed wildcard with
    // "Missing parameter name" at boot.
    consumer.apply(RequestLoggerMiddleware).forRoutes('*splat');
  }
}
