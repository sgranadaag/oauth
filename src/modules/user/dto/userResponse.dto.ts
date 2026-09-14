import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '@modules/user/user.entity';
import { USER_PROPERTY_SWAGGER } from '@modules/user/user.swagger';

export class UserResponseDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.ID)
  readonly id: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.USERNAME)
  readonly username: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.SCOPES)
  readonly scopes: string[];

  private constructor(id: string, username: string, scopes: string[]) {
    this.id = id;
    this.username = username;
    this.scopes = scopes;
  }

  static fromEntity(user: UserEntity, scopes: string[]): UserResponseDto {
    return new UserResponseDto(user.id, user.username, scopes);
  }
}
