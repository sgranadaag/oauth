import { Injectable } from '@nestjs/common';
import { createRandomValue } from '@utils/random.util';
import { isExpired, secondsFromNow } from '@utils/time.util';
import {
  AUTHORIZATION_CODE_TTL_SECONDS,
  AUTHORIZATION_REQUEST_TTL_SECONDS,
  RANDOM_VALUE_BYTES,
} from '@modules/authorization/authorization.constants';
import { AuthorizationCodeEntity } from '@modules/authorization/authorizationCode.entity';
import { AuthorizationRequestEntity } from '@modules/authorization/authorizationRequest.entity';
import { AuthorizationRepository } from '@modules/authorization/authorization.repository';
import type {
  AuthenticatedUser,
  CreateAuthorizationRequestInput,
} from '@modules/authorization/interfaces/authorization.interface';

// The lifecycle of the two short-lived documents of the authorization code
// flow: a pending request, then the code a sign-in turns it into. It stores
// and expires them; deciding whether a request is valid OAuth is the oauth
// module's job, done before anything reaches here.
@Injectable()
export class AuthorizationService {
  constructor(
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  createRequest(
    input: CreateAuthorizationRequestInput,
  ): Promise<AuthorizationRequestEntity> {
    const request = new AuthorizationRequestEntity();
    request.id = createRandomValue(RANDOM_VALUE_BYTES);
    request.clientId = input.clientId;
    request.redirectUri = input.redirectUri;
    request.scope = input.scope;
    request.state = input.state ?? null;
    request.nonce = input.nonce ?? null;
    request.codeChallenge = input.codeChallenge;
    request.expiresAt = secondsFromNow(AUTHORIZATION_REQUEST_TTL_SECONDS);

    return this.authorizationRepository.saveRequest(request);
  }

  async findActiveRequest(
    id: string,
  ): Promise<AuthorizationRequestEntity | null> {
    const request = await this.authorizationRepository.findRequest(id);

    return request && !isExpired(request.expiresAt) ? request : null;
  }

  // Turns a request into a code, once. The request is claimed before the code
  // exists, so a double submit of the same sign-in yields one code, not two.
  async issueCode(
    request: AuthorizationRequestEntity,
    user: AuthenticatedUser,
  ): Promise<string | null> {
    if (!(await this.authorizationRepository.claimRequest(request.id))) {
      return null;
    }

    const code = new AuthorizationCodeEntity();
    code.id = createRandomValue(RANDOM_VALUE_BYTES);
    code.clientId = request.clientId;
    code.redirectUri = request.redirectUri;
    code.userId = user.id;
    code.email = user.email;
    code.scope = request.scope;
    code.codeChallenge = request.codeChallenge;
    code.nonce = request.nonce;
    code.expiresAt = secondsFromNow(AUTHORIZATION_CODE_TTL_SECONDS);
    code.consumedAt = null;

    await this.authorizationRepository.saveCode(code);

    return code.id;
  }

  // A code is spent the moment it is presented, before anything about it is
  // checked: a stolen code tried with the wrong verifier burns it for the
  // thief and the legitimate client alike, rather than staying replayable.
  async redeemCode(value: string): Promise<AuthorizationCodeEntity | null> {
    if (!(await this.authorizationRepository.consumeCode(value))) {
      return null;
    }

    const code = await this.authorizationRepository.findCode(value);

    return code && !isExpired(code.expiresAt) ? code : null;
  }
}
