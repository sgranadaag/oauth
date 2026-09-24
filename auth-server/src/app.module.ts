import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CoreModule } from '@core/core.module';
import { RequestLoggerMiddleware } from '@core/middlewares/requestLogger.middleware';
import { ClientModule } from '@modules/client/client.module';
import { ManagerModule } from '@modules/manager/manager.module';
import { OauthModule } from '@modules/oauth/oauth.module';
import { UserModule } from '@modules/user/user.module';

@Module({
  imports: [CoreModule, ClientModule, ManagerModule, OauthModule, UserModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*splat');
  }
}
