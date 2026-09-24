import { Injectable } from '@nestjs/common';
import { createRandomValue } from '@common/utils/crypto.util';
import { isExpired, secondsFromNow } from '@common/utils/date.util';
import {
  CODE_TTL_SECONDS,
  RANDOM_VALUE_BYTES,
  REQUEST_TTL_SECONDS,
} from '@modules/oauth/authorization/authorization.constants';
import { CodeValueEntity } from '@modules/oauth/authorization/entities/codeValue.entity';
import { RequestEntity } from '@modules/oauth/authorization/entities/request.entity';
import { AuthorizationRepository } from '@modules/oauth/authorization/authorization.repository';
import type {
  ClearedAuthorizationRecords,
  CodeSubject,
  CreateRequestInput,
} from '@modules/oauth/authorization/interfaces/authorization.interface';

@Injectable()
export class AuthorizationService {
  constructor(private readonly repository: AuthorizationRepository) {}

  createRequest(input: CreateRequestInput): Promise<RequestEntity> {
    const request = new RequestEntity();
    request.id = createRandomValue(RANDOM_VALUE_BYTES);
    request.clientId = input.clientId;
    request.redirectUri = input.redirectUri;
    request.scope = input.scope;
    request.state = input.state ?? null;
    request.expiresAt = secondsFromNow(REQUEST_TTL_SECONDS);

    return this.repository.createRequest(request);
  }

  async findActiveRequest(id: string): Promise<RequestEntity | null> {
    const request = await this.repository.findRequest(id);

    return request && !isExpired(request.expiresAt) ? request : null;
  }

  async issueCode(
    request: RequestEntity,
    subject: CodeSubject,
  ): Promise<string | null> {
    const wasClaimed = await this.repository.claimRequest(request.id);

    if (!wasClaimed) return null;

    const code = new CodeValueEntity();
    code.id = createRandomValue(RANDOM_VALUE_BYTES);
    code.clientId = request.clientId;
    code.redirectUri = request.redirectUri;
    code.userId = subject.id;
    code.email = subject.email;
    code.scope = request.scope;
    code.expiresAt = secondsFromNow(CODE_TTL_SECONDS);
    code.consumedAt = null;

    await this.repository.createCode(code);

    return code.id;
  }

  async redeemCode(value: string): Promise<CodeValueEntity | null> {
    const wasConsumed = await this.repository.consumeCode(value);

    if (!wasConsumed) return null;

    const code = await this.repository.findCode(value);

    return code && !isExpired(code.expiresAt) ? code : null;
  }

  async findSpentCode(value: string): Promise<CodeValueEntity | null> {
    const code = await this.repository.findCode(value);

    return code?.consumedAt ? code : null;
  }

  async removeAll(): Promise<ClearedAuthorizationRecords> {
    const requests = await this.repository.removeAllRequests();
    const codes = await this.repository.removeAllCodes();

    return { requests, codes };
  }
}
