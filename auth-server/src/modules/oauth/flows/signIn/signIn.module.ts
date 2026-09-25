import { Module } from '@nestjs/common';
import { ClientModule } from '@modules/client/client.module';
import { AuthorizationModule } from '@modules/oauth/authorization/authorization.module';
import { SessionModule } from '@modules/oauth/session/session.module';
import { SignInService } from '@modules/oauth/flows/signIn/signIn.service';

@Module({
  imports: [ClientModule, AuthorizationModule, SessionModule],
  providers: [SignInService],
  exports: [SignInService],
})
export class SignInModule {}
