import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { CodeValueEntity } from '@modules/oauth/authorization/entities/codeValue.entity';
import { RequestEntity } from '@modules/oauth/authorization/entities/request.entity';

@Injectable()
export class AuthorizationRepository {
  constructor(
    @InjectRepository(RequestEntity)
    private readonly requests: MongoRepository<RequestEntity>,
    @InjectRepository(CodeValueEntity)
    private readonly codes: MongoRepository<CodeValueEntity>,
  ) {}

  createRequest(request: RequestEntity): Promise<RequestEntity> {
    return this.requests.save(request);
  }

  findRequest(id: string): Promise<RequestEntity | null> {
    return this.requests.findOneBy({ id });
  }

  async claimRequest(id: string): Promise<boolean> {
    const result = await this.requests.deleteOne({ id });

    return result.deletedCount === 1;
  }

  createCode(code: CodeValueEntity): Promise<CodeValueEntity> {
    return this.codes.save(code);
  }

  findCode(id: string): Promise<CodeValueEntity | null> {
    return this.codes.findOneBy({ id });
  }

  async consumeCode(id: string): Promise<boolean> {
    const result = await this.codes.updateOne(
      { id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );

    return result.modifiedCount === 1;
  }
}
