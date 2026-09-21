import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { USER_PROPERTY_SWAGGER } from '../user.swagger';

export class ChangePasswordDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.CURRENT_PASSWORD)
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.NEW_PASSWORD)
  @IsString()
  @MinLength(8)
  newPassword: string;
}
