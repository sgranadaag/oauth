import type { UserEntity } from '../user.entity';

export interface SignupResult {
  user: UserEntity;
  allowedScopes: string[];
}
