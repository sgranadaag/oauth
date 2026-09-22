import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '@modules/user/user.entity';
import { USER_PROPERTY_SWAGGER } from '@modules/user/user.swagger';

export class UserResponseDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.ID)
  readonly id: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.EMAIL)
  readonly email: string;

  private constructor(id: string, email: string) {
    this.id = id;
    this.email = email;
  }

  static fromEntity(user: UserEntity): UserResponseDto {
    return new UserResponseDto(user.id, user.email);
  }
}
