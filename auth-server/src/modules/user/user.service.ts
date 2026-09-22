import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hashPassword, verifyPassword } from '@utils/password.util';
import { UserEntity } from '@modules/user/user.entity';
import { UserRepository } from '@modules/user/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async signup(email: string, password: string): Promise<UserEntity> {
    if (await this.userRepository.findByEmail(email)) {
      throw new ConflictException(`Email ${email} is already registered`);
    }

    const user = new UserEntity();
    user.id = randomUUID();
    user.email = email;
    user.passwordHash = await hashPassword(password);

    return this.userRepository.save(user);
  }

  // One failure for every cause — unknown email or wrong password — so the
  // answer cannot be used to find out which emails are registered.
  async verifyCredentials(email: string, password: string): Promise<UserEntity> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
