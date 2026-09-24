import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from '@modules/oauth/session/session.entity';
import { SessionRepository } from '@modules/oauth/session/session.repository';
import { SessionService } from '@modules/oauth/session/session.service';

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  providers: [SessionRepository, SessionService],
  exports: [SessionService],
})
export class SessionModule {}
