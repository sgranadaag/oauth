import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@common/decorators/swaggerDocs.decorator';
import { AdminGuard } from '@common/guards/admin.guard';
import { UserService } from '@modules/user/user.service';
import { USER_SWAGGER } from '@modules/user/user.swagger';
import { SignupDto } from '@modules/user/dto/signup.dto';
import { VerifyCredentialsDto } from '@modules/user/dto/verifyCredentials.dto';
import { UserResponseDto } from '@modules/user/dto/userResponse.dto';

@ApiTags(USER_SWAGGER.API_TAG)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SwaggerDocs(USER_SWAGGER.SIGNUP, UserResponseDto)
  @Post('signup')
  async signup(@Body() dto: SignupDto): Promise<UserResponseDto> {
    const user = await this.userService.signup(dto.email, dto.password);
    return UserResponseDto.fromEntity(user);
  }

  @SwaggerDocs(USER_SWAGGER.VERIFY, UserResponseDto)
  @UseGuards(AdminGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyCredentialsDto): Promise<UserResponseDto> {
    const user = await this.userService.verifyCredentials(
      dto.email,
      dto.password,
    );
    return UserResponseDto.fromEntity(user);
  }
}
