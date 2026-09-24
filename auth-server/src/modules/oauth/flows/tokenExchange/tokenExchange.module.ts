import { Module } from '@nestjs/common';
import { AuthorizationModule } from '@modules/oauth/authorization/authorization.module';
import { TokenModule } from '@modules/oauth/token/token.module';
import { GRANT_TYPES } from '@modules/oauth/flows/tokenExchange/grant.registry';
import { TokenExchangeService } from '@modules/oauth/flows/tokenExchange/tokenExchange.service';

const grantProviders = GRANT_TYPES.map((grant) => grant.service);

@Module({
  imports: [AuthorizationModule, TokenModule],
  providers: [TokenExchangeService, ...grantProviders],
  exports: [TokenExchangeService],
})
export class TokenExchangeModule {}
