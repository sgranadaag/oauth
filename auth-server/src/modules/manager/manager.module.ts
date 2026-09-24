import { Module } from '@nestjs/common';
import { AuthorizationModule } from '@modules/oauth/authorization/authorization.module';
import { SessionModule } from '@modules/oauth/session/session.module';
import { TokenModule } from '@modules/oauth/token/token.module';
import { ManagerController } from '@modules/manager/manager.controller';
import { ManagerService } from '@modules/manager/manager.service';

@Module({
  imports: [AuthorizationModule, SessionModule, TokenModule],
  controllers: [ManagerController],
  providers: [ManagerService],
})
export class ManagerModule {}
