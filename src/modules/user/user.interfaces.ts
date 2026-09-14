import type { UserEntity } from '@modules/user/user.entity';

export interface SignupResult {
  user: UserEntity;
  allowedScopes: string[];
}
