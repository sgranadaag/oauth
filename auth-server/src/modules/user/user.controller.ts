import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwaggerDocs } from '@decorators/swaggerDocs.decorator';
import { BasicTokenGuard } from '@guards/basicToken.guard';
import { BearerTokenGuard } from '@guards/bearerToken.guard';
import type {
  BasicTokenRequest,
  BearerTokenRequest,
} from '@interfaces/authenticatedRequest.interface';
import { UserService } from './user.service';
import { USER_SWAGGER } from './user.swagger';
import { SignupDto } from './dto/signup.dto';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { UserResponseDto } from './dto/userResponse.dto';

@ApiTags(USER_SWAGGER.API_TAG)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @SwaggerDocs(USER_SWAGGER.SIGNUP, UserResponseDto)
  @UseGuards(BasicTokenGuard)
  @Post('signup')
  async signup(
    @Req() request: BasicTokenRequest,
    @Body() dto: SignupDto,
  ): Promise<UserResponseDto> {
    const { user, allowedScopes } = await this.userService.signup(
      request.client.id,
      dto.email,
      dto.password,
    );
    return UserResponseDto.fromEntity(user, allowedScopes);
  }

  @SwaggerDocs(USER_SWAGGER.DELETE)
  @UseGuards(BasicTokenGuard)
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: BasicTokenRequest,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.userService.remove(request.client.id, userId);
  }

  @SwaggerDocs(USER_SWAGGER.CHANGE_PASSWORD)
  @UseGuards(BearerTokenGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() request: BearerTokenRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.userService.changePassword(
      request.token,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
