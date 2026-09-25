import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientRepository } from '@modules/client/client.repository';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '@modules/user/user.util';
import { UserEntity } from '@modules/user/user.entity';
import { UserRepository } from '@modules/user/user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async signup(
    clientId: string,
    email: string,
    password: string,
  ): Promise<UserEntity> {
    const client = await this.clientRepository.find(clientId);

    if (!client) {
      throw new BadRequestException(`Unknown client_id ${clientId}`);
    }

    const existingUser = await this.userRepository.findByEmail(clientId, email);

    if (existingUser) {
      throw new ConflictException(
        `Email ${email} is already registered for this client`,
      );
    }

    const user = new UserEntity();
    user.id = randomUUID();
    user.clientId = clientId;
    user.email = email;
    user.passwordHash = await hashPassword(password);

    return this.userRepository.create(user);
  }

  async verifyCredentials(
    clientId: string,
    email: string,
    password: string,
  ): Promise<UserEntity> {
    const user = await this.userRepository.findByEmail(clientId, email);

    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const hasValidPassword = await verifyPassword(password, passwordHash);

    if (!user || !hasValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
