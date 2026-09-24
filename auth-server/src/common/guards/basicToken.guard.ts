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

    const body = request.body as { client_id?: string } | undefined;
    const clientId = credentials?.id ?? body?.client_id;

    const client = await this.clientRepository.find(clientId);
    if (!client) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    if (client.isPublic) {
      this.rejectSecretFromPublicClient(credentials?.secret);
    } else {
      this.requireSecret(client.clientSecret, credentials?.secret);
    }

    request.client = client;
    return true;
  }

  private rejectSecretFromPublicClient(secret?: string): void {
    if (secret) {
      throw new UnauthorizedException('Invalid client credentials');
    }
  }

  private requireSecret(expected: string, presented?: string): void {
    if (!presented || !constantTimeEquals(presented, expected)) {
      throw new UnauthorizedException('Invalid client credentials');
    }
  }
}
