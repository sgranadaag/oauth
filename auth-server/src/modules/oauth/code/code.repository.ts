import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { CodeEntity } from '@modules/oauth/code/entities/code.entity';
import { CodeRequestEntity } from '@modules/oauth/code/entities/codeRequest.entity';

@Injectable()
export class CodeRepository {
  constructor(
    @InjectRepository(CodeRequestEntity)
    private readonly requests: MongoRepository<CodeRequestEntity>,
    @InjectRepository(CodeEntity)
    private readonly codes: MongoRepository<CodeEntity>,
  ) {}

  saveRequest(
    request: CodeRequestEntity,
  ): Promise<CodeRequestEntity> {
    return this.requests.save(request);
  }

  findRequest(id: string): Promise<CodeRequestEntity | null> {
    return this.requests.findOneBy({ id });
  }

  async claimRequest(id: string): Promise<boolean> {
    const result = await this.requests.deleteOne({ id });
    return result.deletedCount === 1;
  }

  saveCode(code: CodeEntity): Promise<CodeEntity> {
    return this.codes.save(code);
  }

  findCode(id: string): Promise<CodeEntity | null> {
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
