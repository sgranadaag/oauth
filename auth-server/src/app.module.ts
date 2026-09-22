import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mongoConfig } from '@config/mongo.config';
import { RequestLoggerMiddleware } from '@middlewares/requestLogger.middleware';
import { ClientModule } from './modules/client/client.module';
import { OauthModule } from './modules/oauth/oauth.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: mongoConfig,
    }),
    ClientModule,
    OauthModule,
    UserModule,
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
