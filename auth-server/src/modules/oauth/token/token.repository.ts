import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { TokenEntity } from '@modules/oauth/token/token.entity';

@Injectable()
export class TokenRepository {
  constructor(
    @InjectRepository(TokenEntity)
    private readonly repository: MongoRepository<TokenEntity>,
  ) {}

  create(token: TokenEntity): Promise<TokenEntity> {
    return this.repository.save(token);
  }

  find(id: string): Promise<TokenEntity | null> {
    return this.repository.findOneBy({ id });
  }

  findByCodeId(codeId: string): Promise<TokenEntity | null> {
    return this.repository.findOneBy({ codeId });
  }

  async consume(id: string): Promise<boolean> {
    const result = await this.repository.updateOne(
      { id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );

    return result.modifiedCount === 1;
  }

  async removeBySessionId(sessionId: string): Promise<void> {
    await this.repository.deleteMany({ sessionId });
  }

  async removeAll(): Promise<number> {
    const result = await this.repository.deleteMany({});

    return result.deletedCount;
  }
}
