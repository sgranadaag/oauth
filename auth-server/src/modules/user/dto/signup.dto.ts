import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { USER_PROPERTY_SWAGGER } from '@modules/user/user.swagger';

export class SignupDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.EMAIL)
  @IsEmail()
  email: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.PASSWORD)
  @IsString()
  @IsNotEmpty()
  password: string;
}
