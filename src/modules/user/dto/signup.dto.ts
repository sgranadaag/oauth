import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { USER_PROPERTY_SWAGGER } from '@modules/user/user.swagger';

export class SignupDto {
  @ApiProperty(USER_PROPERTY_SWAGGER.USERNAME)
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty(USER_PROPERTY_SWAGGER.PASSWORD)
  @IsString()
  @IsNotEmpty()
  password: string;
}
