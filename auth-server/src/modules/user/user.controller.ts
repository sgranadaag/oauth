import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@common/decorators/swaggerDocs.decorator';
import { UserService } from '@modules/user/user.service';
import { USER_SWAGGER } from '@modules/user/user.swagger';
import { SignupDto } from '@modules/user/dto/signup.dto';
import { UserResponseDto } from '@modules/user/dto/userResponse.dto';

@ApiTags(USER_SWAGGER.API_TAG)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SwaggerDocs(USER_SWAGGER.SIGNUP, UserResponseDto)
  @Post('signup')
  async signup(@Body() dto: SignupDto): Promise<UserResponseDto> {
    const user = await this.userService.signup(
      dto.clientId,
      dto.email,
      dto.password,
    );

    return UserResponseDto.fromEntity(user);
  }
}
