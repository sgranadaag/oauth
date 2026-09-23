import { Module } from '@nestjs/common';
import { BasicTokenGuard } from '@common/guards/basicToken.guard';
import { ClientModule } from '@modules/client/client.module';
import { CodeModule } from '@modules/oauth/code/code.module';
import { TokenModule } from '@modules/oauth/token/token.module';
import { ScopeModule } from '@modules/oauth/scope/scope.module';
import { GrantModule } from '@modules/oauth/grant/grant.module';
import { OauthController } from '@modules/oauth/oauth.controller';
import { OauthService } from '@modules/oauth/oauth.service';

@Module({
  imports: [
    ClientModule,
    CodeModule,
    TokenModule,
    ScopeModule,
    GrantModule,
  ],
  controllers: [OauthController],
  providers: [OauthService, BasicTokenGuard],
})
export class OauthModule {}
