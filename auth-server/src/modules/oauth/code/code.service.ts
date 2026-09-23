import { Injectable } from '@nestjs/common';
import { createRandomValue } from '@common/utils/crypto.util';
import { isExpired, secondsFromNow } from '@common/utils/date.util';
import {
  CODE_REQUEST_TTL_SECONDS,
  CODE_TTL_SECONDS,
  RANDOM_VALUE_BYTES,
} from '@modules/oauth/code/code.constants';
import { CodeEntity } from '@modules/oauth/code/entities/code.entity';
import { CodeRequestEntity } from '@modules/oauth/code/entities/codeRequest.entity';
import { CodeRepository } from '@modules/oauth/code/code.repository';
import type {
  CodeSubject,
  CreateCodeRequestInput,
} from '@modules/oauth/code/interfaces/code.interface';

@Injectable()
export class CodeService {
  constructor(
    private readonly codeRepository: CodeRepository,
  ) {}

  createRequest(
    input: CreateCodeRequestInput,
  ): Promise<CodeRequestEntity> {
    const request = new CodeRequestEntity();
    request.id = createRandomValue(RANDOM_VALUE_BYTES);
    request.clientId = input.clientId;
    request.redirectUri = input.redirectUri;
    request.scope = input.scope;
    request.state = input.state ?? null;
    request.nonce = input.nonce ?? null;
    request.codeChallenge = input.codeChallenge;
    request.expiresAt = secondsFromNow(CODE_REQUEST_TTL_SECONDS);

    return this.codeRepository.saveRequest(request);
  }

  async findActiveRequest(
    id: string,
  ): Promise<CodeRequestEntity | null> {
    const request = await this.codeRepository.findRequest(id);

    return request && !isExpired(request.expiresAt) ? request : null;
  }

  async issueCode(
    request: CodeRequestEntity,
    user: CodeSubject,
  ): Promise<string | null> {
    const wasClaimed = await this.codeRepository.claimRequest(
      request.id,
    );

    if (!wasClaimed) return null;

    const code = new CodeEntity();
    code.id = createRandomValue(RANDOM_VALUE_BYTES);
    code.clientId = request.clientId;
    code.redirectUri = request.redirectUri;
    code.userId = user.id;
    code.email = user.email;
    code.scope = request.scope;
    code.codeChallenge = request.codeChallenge;
    code.nonce = request.nonce;
    code.expiresAt = secondsFromNow(CODE_TTL_SECONDS);
    code.consumedAt = null;

    await this.codeRepository.saveCode(code);

    return code.id;
  }

  async redeemCode(value: string): Promise<CodeEntity | null> {
    const wasConsumed = await this.codeRepository.consumeCode(value);

    if (!wasConsumed) return null;

    const code = await this.codeRepository.findCode(value);

    return code && !isExpired(code.expiresAt) ? code : null;
  }
}
