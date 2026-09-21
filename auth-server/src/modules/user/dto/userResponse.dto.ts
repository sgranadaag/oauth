import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../user.entity';
import { USER_PROPERTY_SWAGGER } from '../user.swagger';

export class UserResponseDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.ID)
  readonly id: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.EMAIL)
  readonly email: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.SCOPES)
  readonly scopes: string[];

  private constructor(id: string, email: string, scopes: string[]) {
    this.id = id;
    this.email = email;
    this.scopes = scopes;
  }

  static fromEntity(user: UserEntity, scopes: string[]): UserResponseDto {
    return new UserResponseDto(user.id, user.email, scopes);
  }
}
