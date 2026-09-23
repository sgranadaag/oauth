import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { BasicTokenRequest } from '@common/interfaces/authenticatedRequest.interface';
import { decodeBasicAuth } from '@common/utils/http.util';
import { constantTimeEquals } from '@common/utils/crypto.util';
import { ClientRepository } from '@modules/client/client.repository';

@Injectable()
export class BasicTokenGuard implements CanActivate {
  constructor(private readonly clientRepository: ClientRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BasicTokenRequest>();
    const credentials = decodeBasicAuth(request.header('authorization'));

    if (!credentials) {
      throw new UnauthorizedException('Missing or malformed client credentials');
    }

    const client = await this.clientRepository.findByClientId(credentials.id);
    const hasValidSecret =
      !!client && constantTimeEquals(credentials.secret, client.clientSecret);

    if (!client || !hasValidSecret) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    request.client = client;
    return true;
  }
}
