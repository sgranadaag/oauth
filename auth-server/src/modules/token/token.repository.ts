import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { TokenEntity } from '@modules/token/token.entity';

@Injectable()
export class TokenRepository {
  constructor(
    @InjectRepository(TokenEntity)
    private readonly repository: MongoRepository<TokenEntity>,
  ) {}

  save(token: TokenEntity): Promise<TokenEntity> {
    return this.repository.save(token);
  }

  findById(id: string): Promise<TokenEntity | null> {
    return this.repository.findOneBy({ id });
  }

  // Marks the token spent, but only if nothing else did it first: the filter
  // carries `consumedAt: null`, so of two requests presenting the same token
  // exactly one sees a modified document. That is what makes rotation safe
  // without a transaction, and what lets the caller treat `false` as reuse.
  async consume(id: string): Promise<boolean> {
    const result = await this.repository.updateOne(
      { id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );

    return result.modifiedCount === 1;
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.repository.deleteMany({ sessionId });
  }
}
