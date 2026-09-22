import { Module } from '@nestjs/common';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import { AuthorizationModule } from '@modules/authorization/authorization.module';
import { ClientModule } from '@modules/client/client.module';
import { TokenModule } from '@modules/token/token.module';
import { OauthController } from '@modules/oauth/oauth.controller';
import { OauthService } from '@modules/oauth/oauth.service';
import { ScopeService } from '@modules/oauth/scope.service';
import { GRANT_TYPES } from '@modules/oauth/grantTypes/grantTypes.registry';

// Every grant service becomes a provider, so ModuleRef can resolve it per
// request. Derived from the registry rather than listed by hand — adding a
// grant touches only grantTypes.registry.ts.
const grantTypeProviders = GRANT_TYPES.map((grant) => grant.service);

@Module({
  imports: [ClientModule, AuthorizationModule, TokenModule],
  controllers: [OauthController],
  providers: [
    OauthService,
    ScopeService,
    BasicTokenGuard,
    ...grantTypeProviders,
  ],
})
export class OauthModule {}
