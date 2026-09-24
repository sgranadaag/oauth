import { Injectable } from '@nestjs/common';
import { createRandomValue } from '@common/utils/crypto.util';
import { isExpired, secondsFromNow } from '@common/utils/date.util';
import {
  SESSION_BYTES,
  SESSION_TTL_SECONDS,
} from '@modules/oauth/session/session.constants';
import { SessionEntity } from '@modules/oauth/session/session.entity';
import { SessionRepository } from '@modules/oauth/session/session.repository';

@Injectable()
export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async start(
    userId: string,
    email: string,
    clientId: string,
  ): Promise<SessionEntity> {
    const session = new SessionEntity();
    session.id = createRandomValue(SESSION_BYTES);
    session.userId = userId;
    session.email = email;
    session.clientId = clientId;
    session.expiresAt = secondsFromNow(SESSION_TTL_SECONDS);

    return this.sessionRepository.create(session);
  }

  async findActive(id?: string): Promise<SessionEntity | null> {
    const session = await this.sessionRepository.find(id);
    if (!session) return null;

    if (isExpired(session.expiresAt)) {
      await this.sessionRepository.remove(session.id);
      return null;
    }

    return session;
  }

  async end(id?: string): Promise<void> {
    if (!id) return;

    await this.sessionRepository.remove(id);
  }

  removeAll(): Promise<number> {
    return this.sessionRepository.removeAll();
  }
}
