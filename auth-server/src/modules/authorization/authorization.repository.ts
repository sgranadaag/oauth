import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { AuthorizationCodeEntity } from '@modules/authorization/authorizationCode.entity';
import { AuthorizationRequestEntity } from '@modules/authorization/authorizationRequest.entity';

// One repository for the module's two short-lived documents: they are two
// stages of the same flow and are never read apart from each other.
@Injectable()
export class AuthorizationRepository {
  constructor(
    @InjectRepository(AuthorizationRequestEntity)
    private readonly requests: MongoRepository<AuthorizationRequestEntity>,
    @InjectRepository(AuthorizationCodeEntity)
    private readonly codes: MongoRepository<AuthorizationCodeEntity>,
  ) {}

  saveRequest(
    request: AuthorizationRequestEntity,
  ): Promise<AuthorizationRequestEntity> {
    return this.requests.save(request);
  }

  findRequest(id: string): Promise<AuthorizationRequestEntity | null> {
    return this.requests.findOneBy({ id });
  }

  // `true` only for the caller whose delete removed the document — which is
  // what lets exactly one of two simultaneous sign-ins turn a request into a
  // code.
  async claimRequest(id: string): Promise<boolean> {
    const result = await this.requests.deleteOne({ id });
    return result.deletedCount === 1;
  }

  saveCode(code: AuthorizationCodeEntity): Promise<AuthorizationCodeEntity> {
    return this.codes.save(code);
  }

  findCode(id: string): Promise<AuthorizationCodeEntity | null> {
    return this.codes.findOneBy({ id });
  }

  // Same shape as refresh token rotation: the filter carries
  // `consumedAt: null`, so a code presented twice is spent only once.
  async consumeCode(id: string): Promise<boolean> {
    const result = await this.codes.updateOne(
      { id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
    );

    return result.modifiedCount === 1;
  }
}
