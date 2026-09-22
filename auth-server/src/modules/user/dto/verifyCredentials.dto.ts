import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { USER_PROPERTY_SWAGGER } from '@modules/user/user.swagger';

export class VerifyCredentialsDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.EMAIL)
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.PASSWORD)
  @IsString()
  @IsNotEmpty()
  password: string;
}
