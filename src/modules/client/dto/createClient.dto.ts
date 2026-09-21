import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { CLIENT_PROPERTY_SWAGGER } from '../client.swagger';

export class CreateClientDto {
  @ApiProperty(CLIENT_PROPERTY_SWAGGER.NAME)
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty(CLIENT_PROPERTY_SWAGGER.ALLOWED_SCOPES)
  @IsArray()
  @IsString({ each: true })
  allowedScopes: string[];
}
