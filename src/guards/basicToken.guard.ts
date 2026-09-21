import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { BasicTokenRequest } from '@interfaces/authenticatedRequest.interface';
import { ClientRepository } from '../modules/client/client.repository';

// Constant-time, so a caller cannot narrow the secret one character at a time by
// measuring response latency. timingSafeEqual throws on differing lengths, hence
// the explicit length check first — that leaks the length only, never content.
// This mirrors what oidc-provider does internally on the token endpoint.
function secretsMatch(submitted: string, stored: string): boolean {
  const submittedBuffer = Buffer.from(submitted, 'utf8');
  const storedBuffer = Buffer.from(stored, 'utf8');

  return (
    submittedBuffer.length === storedBuffer.length &&
    timingSafeEqual(submittedBuffer, storedBuffer)
  );
}

@Injectable()
export class BasicTokenGuard implements CanActivate {
  constructor(private readonly clientRepository: ClientRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BasicTokenRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing client credentials');
    }

    const decoded = Buffer.from(
      header.slice('Basic '.length),
      'base64',
    ).toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Malformed client credentials');
    }
    const clientId = decoded.slice(0, separatorIndex);
    const clientSecret = decoded.slice(separatorIndex + 1);

    const client = await this.clientRepository.findByClientId(clientId);
    if (!client || !secretsMatch(clientSecret, client.clientSecret)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    request.clientId = clientId;
    return true;
  }
}
