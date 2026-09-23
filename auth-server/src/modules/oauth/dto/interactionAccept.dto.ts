import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class InteractionAcceptDto {
  @ApiProperty({
    description: 'The user id /users/verify returned — the tokens `sub`.',
    example: '7b1e4c92-0d3a-4f8b-a6c1-2e5f9d0a3b74',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;
}
