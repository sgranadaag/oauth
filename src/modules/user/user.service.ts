import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AccessTokenClaims } from '@interfaces/accessToken.interface';
import { hashPassword, verifyPassword } from '@utils/password.util';
import { ClientRepository } from '@modules/client/client.repository';
import { UserEntity } from '@modules/user/user.entity';
import { UserRepository } from '@modules/user/user.repository';
import type { SignupResult } from '@modules/user/user.interfaces';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async signup(
    clientId: string,
    username: string,
    password: string,
  ): Promise<SignupResult> {
    const client = await this.clientRepository.findByClientId(clientId);
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    const existing = await this.userRepository.findByClientAndUsername(
      clientId,
      username,
    );
    if (existing) {
      throw new ConflictException(
        `Username ${username} is already registered under this client`,
      );
    }

    const user = new UserEntity();
    user.id = randomUUID();
    user.clientId = clientId;
    user.username = username;
    user.passwordHash = await hashPassword(password);

    const saved = await this.userRepository.save(user);

    return { user: saved, allowedScopes: client.allowedScopes };
  }

  async remove(clientId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user || user.clientId !== clientId) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.userRepository.deleteById(userId);
  }

  async changePassword(
    claims: AccessTokenClaims,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(claims.sub);
    if (!user) {
      throw new NotFoundException(`User ${claims.sub} not found`);
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await hashPassword(newPassword);
    await this.userRepository.save(user);
  }
}
