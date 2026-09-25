import { Module } from '@nestjs/common';
import { BasicTokenGuard } from '@common/guards/basicToken.guard';
import { ClientModule } from '@modules/client/client.module';
import { UserModule } from '@modules/user/user.module';
import { SessionModule } from '@modules/oauth/session/session.module';
import { SignInModule } from '@modules/oauth/flows/signIn/signIn.module';
import { TokenExchangeModule } from '@modules/oauth/flows/tokenExchange/tokenExchange.module';
import { TokenModule } from '@modules/oauth/token/token.module';
import { OauthController } from '@modules/oauth/oauth.controller';

@Module({
  imports: [
    ClientModule,
    UserModule,
    SessionModule,
    SignInModule,
    TokenExchangeModule,
    TokenModule,
  ],
  controllers: [OauthController],
  providers: [BasicTokenGuard],
})
export class OauthModule {}
