import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '@modules/user/user.util';
import { UserEntity } from '@modules/user/user.entity';
import { UserRepository } from '@modules/user/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) { }

  async signup(email: string, password: string): Promise<UserEntity> {
    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException(`Email ${email} is already registered`);
    }

    const user = new UserEntity();
    user.id = randomUUID();
    user.email = email;
    user.passwordHash = await hashPassword(password);

    return this.userRepository.save(user);
  }

  async verifyCredentials(email: string, password: string): Promise<UserEntity> {
    const user = await this.userRepository.findByEmail(email);

    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const hasValidPassword = await verifyPassword(password, passwordHash);

    if (!user || !hasValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
