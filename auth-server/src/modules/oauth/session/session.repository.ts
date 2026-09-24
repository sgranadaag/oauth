import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { SessionEntity } from '@modules/oauth/session/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: MongoRepository<SessionEntity>,
  ) {}

  create(session: SessionEntity): Promise<SessionEntity> {
    return this.sessions.save(session);
  }

  async find(id?: string): Promise<SessionEntity | null> {
    if (!id) return null;

    return this.sessions.findOneBy({ id });
  }

  async remove(id: string): Promise<void> {
    await this.sessions.deleteOne({ id });
  }

  async removeAll(): Promise<number> {
    const result = await this.sessions.deleteMany({});

    return result.deletedCount;
  }
}
