import { Module } from '@nestjs/common';
import { ScopeService } from '@modules/oauth/scope/scope.service';

@Module({
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
