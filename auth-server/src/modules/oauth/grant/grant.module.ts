import { Module } from '@nestjs/common';
import { CodeModule } from '@modules/oauth/code/code.module';
import { TokenModule } from '@modules/oauth/token/token.module';
import { ScopeModule } from '@modules/oauth/scope/scope.module';
import { GRANT_TYPES } from '@modules/oauth/grant/grant.registry';

const grantProviders = GRANT_TYPES.map((grant) => grant.service);

@Module({
  imports: [CodeModule, TokenModule, ScopeModule],
  providers: grantProviders,
  exports: grantProviders,
})
export class GrantModule {}
